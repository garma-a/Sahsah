import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Check,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Mic,
  Plus,
  Search,
  ShieldCheck,
  Square,
  Upload,
  X,
} from 'lucide-react'
import { Logo } from '../components/art'
import { api, getAdminMediaUrl, uploadQuestionMedia } from '../lib/api'
import { DEMO_MODE } from '../lib/runtime'
import { prepareAudio } from '../lib/audio-upload'
import { CATEGORIES, POINTS, toAr } from '../lib/data'
import {
  defaultPointStages,
  MODE_LABELS,
  type AdminQuestion,
  type QuestionType,
} from '../lib/game-types'

const emptyQuestion = (): AdminQuestion => ({
  id: '',
  type: 'STANDARD',
  categoryId: 'general',
  row: 0,
  points: 200,
  packageId: 'أسئلة الشلة',
  prompt: '',
  answerText: '',
  alternatives: [],
  status: 'DRAFT',
  notes: '',
  pointStages: [200, 150, 50],
  focalX: 0.5,
  focalY: 0.5,
  blurSigmas: [32, 16, 6],
  zoomFactors: [8, 4, 2],
  maxPlays: 3,
  allowForward: true,
  stages: [],
})
const defaults: Record<QuestionType, string> = {
  STANDARD: '',
  IMAGE_BLUR: 'خمن اللي في الصورة',
  IMAGE_ZOOM: 'إيه الحاجة دي؟',
  AUDIO_GUESS: 'ده صوت إيه؟',
  AUDIO_REVERSE: 'تقدر تعرف الكلام بالمقلوب؟',
}
const inputClass =
  'mt-2 min-h-12 w-full rounded-xl border border-stroke bg-white px-3 py-2 text-sm text-forest outline-none transition focus:border-gold'
const buttonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stroke bg-white px-4 py-2 text-sm font-semibold text-forest transition hover:border-gold disabled:cursor-not-allowed disabled:opacity-50'
const chromeButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-ivory transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50'
const filterClass =
  'min-h-12 w-full rounded-xl border border-white/20 bg-deep/80 px-3 py-2 text-sm text-ivory outline-none transition placeholder:text-ivory/40 focus:border-gold'
const adminMedia = getAdminMediaUrl

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const id = useId()
  return (
    <div className="block text-sm font-semibold text-forest">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children as ReactElement<{ id?: string; 'aria-describedby'?: string }>, {
        id,
        ...(hint ? { 'aria-describedby': id + '-hint' } : {}),
      })}
      {hint && (
        <span
          id={id + '-hint'}
          className="mt-1.5 block text-xs font-normal leading-5 text-forest/55"
        >
          {hint}
        </span>
      )}
    </div>
  )
}

function QuestionEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: AdminQuestion
  onClose: () => void
  onSaved: (q: AdminQuestion) => void
}) {
  const [q, setQ] = useState(initial)
  const [file, setFile] = useState<File | Blob | null>(null)
  const [sourcePreview, setSourcePreview] = useState('')
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(''),
    [error, setError] = useState('')
  const [recording, setRecording] = useState(false),
    [recordedSeconds, setRecordedSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null)
  const image = q.type === 'IMAGE_BLUR' || q.type === 'IMAGE_ZOOM'
  const audio = q.type === 'AUDIO_GUESS' || q.type === 'AUDIO_REVERSE'
  const patch = (value: Partial<AdminQuestion>) => setQ((previous) => ({ ...previous, ...value }))
  useEffect(() => {
    if (!file) {
      setSourcePreview('')
      return
    }
    const url = URL.createObjectURL(file)
    setSourcePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  useEffect(() => {
    if (!recording) return
    const tick = setInterval(() => setRecordedSeconds((value) => value + 1), 1000)
    const limit = setTimeout(() => recorder.current?.stop(), 29000)
    return () => {
      clearInterval(tick)
      clearTimeout(limit)
    }
  }, [recording])
  useEffect(
    () => () => {
      if (recorder.current?.state === 'recording') recorder.current.stop()
      stream.current?.getTracks().forEach((track) => track.stop())
    },
    [],
  )

  const record = async () => {
    if (recording) {
      recorder.current?.stop()
      return
    }
    setError('')
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.current = media
      const capture = new MediaRecorder(media)
      recorder.current = capture
      const chunks: Blob[] = []
      capture.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data)
      }
      capture.onstop = () => {
        setFile(new Blob(chunks, { type: capture.mimeType }))
        setRecording(false)
        media.getTracks().forEach((track) => track.stop())
      }
      capture.start()
      setRecordedSeconds(0)
      setRecording(true)
    } catch {
      setError('الميكروفون مش متاح. اسمح باستخدامه أو ارفع ملف.')
    }
  }
  const chooseFile = (selected?: File) => {
    if (!selected) return
    if (selected.size > 15 * 1024 * 1024) {
      setError('حجم الملف بحد أقصى ١٥ ميجا')
      return
    }
    setError('')
    setFile(selected)
  }
  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || recording) return
    setBusy(true)
    setError('')
    try {
      setProgress('حفظ بيانات السؤال…')
      const desiredStatus = q.status
      let saved = await api<AdminQuestion>(
        q.id ? `/api/admin/questions/${q.id}` : '/api/admin/questions',
        { ...q, status: 'DRAFT' },
        q.id ? 'PATCH' : 'POST',
      )
      setQ((previous) => ({ ...previous, id: saved.id }))
      if (file) {
        setProgress(image ? 'توليد مراحل الصورة…' : 'تحضير الصوت…')
        const bytes = image ? file : await prepareAudio(file)
        saved = await uploadQuestionMedia(saved.id, bytes)
      } else if (image && saved.originalImage) {
        setProgress('تحديث مراحل الصورة…')
        saved = await api<AdminQuestion>(`/api/admin/questions/${saved.id}/generate-stages`, {})
      }
      if (q.type === 'AUDIO_REVERSE' && saved.forwardSpeech) {
        setProgress('توليد الصوت المعكوس…')
        saved = await api<AdminQuestion>(`/api/admin/questions/${saved.id}/generate-reverse`, {})
      }
      saved = await api<AdminQuestion>(
        `/api/admin/questions/${saved.id}`,
        { ...saved, status: desiredStatus },
        'PATCH',
      )
      setQ(saved)
      setFile(null)
      onSaved(saved)
      setProgress('المعاينة جاهزة')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'السؤال مش اتحفظ')
    } finally {
      setBusy(false)
    }
  }
  const original = sourcePreview || adminMedia(q.originalImage)
  return (
    <form onSubmit={save} className="paper min-w-0 rounded-[24px] p-5 sm:p-7">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-forest/50">محتوى اللعبة</p>
          <h2 className="mt-1 font-display text-3xl">{q.id ? 'تعديل السؤال' : 'سؤال جديد'}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className={buttonClass}
          aria-label="إغلاق محرر السؤال"
        >
          <X size={18} />
        </button>
      </div>
      <fieldset disabled={busy} className="space-y-5 disabled:opacity-70">
        <Field label="نوع السؤال">
          <select
            value={q.type}
            onChange={(event) => {
              const type = event.target.value as QuestionType
              setFile(null)
              patch({
                type,
                prompt: q.prompt === defaults[q.type] || !q.prompt ? defaults[type] : q.prompt,
              })
            }}
            className={inputClass}
          >
            {Object.entries(MODE_LABELS).map(([type, name]) => (
              <option key={type} value={type}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="نص السؤال">
          <textarea
            required
            value={q.prompt}
            maxLength={300}
            onChange={(event) => patch({ prompt: event.target.value })}
            className={`${inputClass} min-h-24 resize-y`}
            placeholder={defaults[q.type] || 'اكتب سؤال قصير…'}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الفئة">
            <select
              className={inputClass}
              value={q.categoryId}
              onChange={(event) => patch({ categoryId: event.target.value })}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="مكان السؤال في الفئة" hint="كل سؤال بياخد خانة واحدة من ٦.">
            <select
              className={inputClass}
              value={q.row}
              onChange={(event) => {
                const row = +event.target.value
                patch({
                  row,
                  points: POINTS[row],
                  pointStages: defaultPointStages(POINTS[row]),
                })
              }}
            >
              {POINTS.map((points, row) => (
                <option key={row} value={row}>
                  الخانة {toAr(row + 1)} · {points} نقطة
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="الباقة">
          <input
            value={q.packageId}
            maxLength={60}
            onChange={(event) => patch({ packageId: event.target.value })}
            className={inputClass}
          />
        </Field>
        <div className="rounded-2xl border border-gold/25 bg-cream p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-forest/60">
            <LockKeyhole size={14} /> خاص بالإدارة — بيظهر بعد كشف الإجابة
          </div>
          <Field label={q.type === 'AUDIO_REVERSE' ? 'الكلام الأصلي / الإجابة' : 'الإجابة الصحيحة'}>
            <input
              value={q.answerText}
              maxLength={300}
              onChange={(event) => patch({ answerText: event.target.value })}
              className={inputClass}
            />
          </Field>
          <div className="mt-4">
            <Field label="إجابات بديلة" hint="افصل بين الإجابات بفاصلة عربية.">
              <input
                value={q.alternatives.join('، ')}
                onChange={(event) =>
                  patch({
                    alternatives: event.target.value.split('،').map((value) => value.trim()),
                  })
                }
                className={inputClass}
              />
            </Field>
          </div>
        </div>
        {(image || audio) && (
          <div className="rounded-2xl border border-dashed border-stroke bg-cream/50 p-4">
            <Field
              label={
                image
                  ? 'الصورة الأصلية'
                  : q.type === 'AUDIO_REVERSE'
                    ? 'ارفع تسجيل الكلام الأصلي'
                    : 'ملف الصوت'
              }
              hint={
                image
                  ? 'JPG / PNG / WebP · حتى ١٥ ميجا. المراحل من نفس الصورة.'
                  : 'WAV / MP3 / M4A حسب دعم المتصفح · حتى ٣٠ ثانية.'
              }
            >
              <input
                aria-label={image ? 'رفع الصورة' : 'رفع الصوت'}
                type="file"
                accept={image ? 'image/jpeg,image/png,image/webp' : 'audio/*,.wav,.mp3,.m4a'}
                onChange={(event) => chooseFile(event.target.files?.[0])}
                className={`${inputClass} file:me-3 file:rounded-lg file:border-0 file:bg-gold/20 file:px-3 file:py-2 file:text-forest`}
              />
            </Field>
            {audio && (
              <button
                type="button"
                onClick={record}
                className={`${buttonClass} mt-3 ${recording ? 'border-play text-play' : ''}`}
              >
                {recording ? <Square size={16} fill="currentColor" /> : <Mic size={16} />}
                {recording ? `وقف التسجيل · ${toAr(recordedSeconds)} ثانية` : 'سجّل بالميكروفون'}
              </button>
            )}
            {file && (
              <p className="mt-2 flex items-center gap-2 text-xs text-forest/60">
                <Check size={13} />
                {'name' in file ? String(file.name) : 'التسجيل جاهز'} ·{' '}
                {Math.round(file.size / 1024)} KB
              </p>
            )}
          </div>
        )}
        {image && (
          <>
            {original && (
              <div>
                <p className="mb-2 text-xs text-forest/55">
                  {q.type === 'IMAGE_ZOOM'
                    ? 'اضغط على الصورة لتحديد نقطة التركيز'
                    : 'الصورة الأصلية — معاينة الإدارة'}
                </p>
                <button
                  type="button"
                  disabled={q.type !== 'IMAGE_ZOOM'}
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect()
                    patch({
                      focalX: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
                      focalY: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
                    })
                  }}
                  className="relative block w-full overflow-hidden rounded-xl border border-stroke"
                  aria-label="اختيار نقطة التركيز"
                >
                  <img src={original} alt="الصورة الأصلية للإدارة" className="block h-auto w-full" />
                  {q.type === 'IMAGE_ZOOM' && (
                    <span
                      className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-gold/50 shadow-[0_0_0_2px_#0d2e1d]"
                      style={{
                        left: `${q.focalX * 100}%`,
                        top: `${q.focalY * 100}%`,
                      }}
                    />
                  )}
                </button>
              </div>
            )}
            {q.type === 'IMAGE_ZOOM' && (
              <div className="grid grid-cols-2 gap-3">
                {(['focalX', 'focalY'] as const).map((key) => (
                  <Field key={key} label={key === 'focalX' ? 'التركيز الأفقي' : 'التركيز الرأسي'}>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step=".01"
                      value={Number(q[key].toFixed(2))}
                      onChange={(event) => patch({ [key]: +event.target.value })}
                      className={inputClass}
                      dir="ltr"
                    />
                  </Field>
                ))}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold">المراحل والنقط</p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {q.pointStages.map((points, i) => (
                  <div key={i} className="rounded-xl bg-cream p-3">
                    <span className="text-xs text-forest/60">المرحلة {toAr(i + 1)}</span>
                    <label className="mt-2 block text-xs text-forest/60">
                      النقط
                      <input
                        aria-label={`نقط المرحلة ${i + 1}`}
                        type="number"
                        required
                        min="1"
                        max={q.points}
                        value={points}
                        disabled={i === 0}
                        onChange={(event) =>
                          patch({
                            pointStages: q.pointStages.map((value, j) =>
                              j === i ? +event.target.value : value,
                            ),
                          })
                        }
                        className={`${inputClass} !px-2`}
                        dir="ltr"
                      />
                    </label>
                    <label className="mt-3 block text-xs text-forest/60">
                      {q.type === 'IMAGE_BLUR' ? 'التشويش' : 'التكبير'}
                      <input
                        aria-label={`درجة المرحلة ${i + 1}`}
                        type="number"
                        required
                        min={q.type === 'IMAGE_BLUR' ? 0.3 : 1}
                        max={q.type === 'IMAGE_BLUR' ? 100 : 20}
                        step=".1"
                        value={q.type === 'IMAGE_BLUR' ? q.blurSigmas[i] : q.zoomFactors[i]}
                        onChange={(event) =>
                          patch(
                            q.type === 'IMAGE_BLUR'
                              ? {
                                  blurSigmas: q.blurSigmas.map((v, j) =>
                                    i === j ? +event.target.value : v,
                                  ),
                                }
                              : {
                                  zoomFactors: q.zoomFactors.map((v, j) =>
                                    i === j ? +event.target.value : v,
                                  ),
                                },
                          )
                        }
                        className={`${inputClass} !px-2`}
                        dir="ltr"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
            {q.stages.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {q.stages.map((id, i) => (
                  <div key={id}>
                    <img
                      src={adminMedia(id)}
                      alt={`معاينة المرحلة ${i + 1}`}
                      className="aspect-[4/3] w-full rounded-xl border border-stroke object-contain"
                    />
                    <p className="mt-1 text-center text-xs text-forest/60">
                      {q.pointStages[i]} نقطة
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {audio && (
          <>
            <Field label="مرات التشغيل للشلة كلها">
              <input
                type="number"
                min="1"
                max="10"
                required
                value={q.maxPlays}
                onChange={(event) => patch({ maxPlays: +event.target.value })}
                className={inputClass}
              />
            </Field>
            {sourcePreview && (
              <div>
                <p className="mb-2 text-xs text-forest/55">معاينة الملف المختار</p>
                <audio controls src={sourcePreview} className="h-10 w-full" />
              </div>
            )}
            {q.type === 'AUDIO_REVERSE' && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={q.allowForward}
                  onChange={(event) => patch({ allowForward: event.target.checked })}
                  className="h-4 w-4 accent-forest"
                />{' '}
                تشغيل الأصل بعد كشف الإجابة
              </label>
            )}
            {q.forwardSpeech && q.type === 'AUDIO_REVERSE' && (
              <div>
                <p className="mb-2 text-xs text-forest/55">الأصل — خاص بالإدارة</p>
                <audio controls src={adminMedia(q.forwardSpeech)} className="h-10 w-full" />
              </div>
            )}
            {q.playableAudio && (
              <div>
                <p className="mb-2 text-xs text-forest/55">
                  {q.type === 'AUDIO_REVERSE' ? 'معاينة الصوت المعكوس' : 'معاينة صوت السؤال'}
                </p>
                <audio controls src={adminMedia(q.playableAudio)} className="h-10 w-full" />
              </div>
            )}
          </>
        )}
        <Field label="ملاحظات المحتوى (خاصة)">
          <textarea
            value={q.notes}
            maxLength={1500}
            onChange={(event) => patch({ notes: event.target.value })}
            className={`${inputClass} min-h-20`}
          />
        </Field>
        <Field
          label="حالة السؤال"
          hint="النشر بيستبدل السؤال المنشور في نفس الخانة للألعاب الجديدة. الألعاب الحالية بتكمل بمحتواها."
        >
          <select
            value={q.status}
            onChange={(event) => patch({ status: event.target.value as AdminQuestion['status'] })}
            className={inputClass}
          >
            <option value="DRAFT">مسودة</option>
            <option value="PUBLISHED">منشور</option>
            <option value="ARCHIVED">مؤرشف</option>
          </select>
        </Field>
      </fieldset>
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-play/8 p-3 text-sm text-play">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-stroke pt-5">
        <button
          type="submit"
          disabled={busy || recording}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-forest px-6 text-sm font-bold text-ivory disabled:opacity-50"
        >
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : <Upload size={18} />}
          {busy
            ? 'جاري الحفظ'
            : image
              ? 'حفظ وتوليد المراحل'
              : q.type === 'AUDIO_REVERSE'
                ? 'حفظ وتوليد الصوت المعكوس'
                : 'حفظ السؤال'}
        </button>
        <span role="status" aria-live="polite" className="text-xs text-forest/60">
          {progress}
        </span>
      </div>
    </form>
  )
}

export default function AdminPage() {
  const [auth, setAuth] = useState<{
    authenticated: boolean
    setupRequired: boolean
  } | null>(null)
  const [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [questions, setQuestions] = useState<AdminQuestion[]>([]),
    [edit, setEdit] = useState<AdminQuestion | null>(null)
  const [search, setSearch] = useState(''),
    [type, setType] = useState(''),
    [category, setCategory] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  useEffect(() => {
    api<{ authenticated: boolean; setupRequired: boolean }>('/api/admin/auth')
      .then(setAuth)
      .catch(() => setError('السيرفر مش متاح دلوقتي'))
  }, [])
  const reload = () =>
    api<AdminQuestion[]>('/api/admin/questions')
      .then(setQuestions)
      .catch((err) => setError(err.message))
  useEffect(() => {
    if (auth?.authenticated) void reload()
  }, [auth?.authenticated])
  const login = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/api/admin/auth', { password })
      setPassword('')
      setAuth({ authenticated: true, setupRequired: false })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'مش قادرين ندخل')
    } finally {
      setBusy(false)
    }
  }
  const filtered = questions.filter(
    (q) =>
      (!type || q.type === type) &&
      (!category || q.categoryId === category) &&
      (!search || `${q.prompt} ${q.answerText}`.includes(search)),
  )
  return (
    <div className="min-h-dvh">
      <header className="border-b border-white/15 bg-deep/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-5 py-4">
          <span className="rounded-xl bg-forest p-1.5">
            <Logo size={40} mark />
          </span>
          <div>
            <h1 className="font-display text-2xl leading-none">إدارة صح صح</h1>
            <p className="mt-1 text-xs text-ivory/50">
              الأسئلة والمحتوى{DEMO_MODE ? ' · نسخة تجريبية' : ''}
            </p>
          </div>
          <Link to="/play" className={`${chromeButtonClass} ms-auto`}>
            <ArrowRight size={16} /> اللعبة
          </Link>
          {auth?.authenticated && (
            <button
              onClick={async () => {
                await api('/api/admin/auth', undefined, 'DELETE')
                setAuth({ authenticated: false, setupRequired: false })
                setQuestions([])
                setEdit(null)
              }}
              className={`${chromeButtonClass} hidden sm:flex`}
            >
              خروج
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-[1240px] px-4 py-7 sm:px-6">
        {!auth?.authenticated ? (
          <div className="paper mx-auto mt-12 max-w-sm rounded-[24px] p-7">
            <div className="mb-4 inline-flex rounded-2xl bg-gold/15 p-3">
              <ShieldCheck size={28} />
            </div>
            <h2 className="font-display text-3xl">
              {auth?.setupRequired ? 'جهّز حساب الإدارة' : 'دخول الإدارة'}
            </h2>
            <p className="mt-2 text-xs leading-6 text-forest/60">
              {auth?.setupRequired
                ? 'إعداد كلمة السر لأول مرة من جهاز السيرفر. ١٠ حروف على الأقل.'
                : 'الأسئلة والإجابات الخاصة في مكان واحد.'}
            </p>
            <form onSubmit={login} className="mt-5">
              <Field label="كلمة السر">
                <input
                  required
                  type="password"
                  autoComplete={auth?.setupRequired ? 'new-password' : 'current-password'}
                  minLength={auth?.setupRequired ? 10 : 1}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={inputClass}
                />
              </Field>
              {error && (
                <p role="alert" className="mt-3 text-sm text-play">
                  {error}
                </p>
              )}
              <button
                disabled={busy || !auth}
                className="mt-5 min-h-12 w-full rounded-xl bg-forest font-bold text-ivory disabled:opacity-50"
              >
                {busy ? 'ثانية واحدة…' : auth?.setupRequired ? 'إنشاء حساب الإدارة' : 'ادخل'}
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs text-gold">بنك الأسئلة</p>
                <h2 className="mt-1 font-display text-4xl">كل سؤال، له حكاية</h2>
              </div>
              <button
                className="btn-play ms-auto inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                onClick={() => {
                  setSavedMessage('')
                  setEdit(emptyQuestion())
                }}
              >
                <Plus size={18} /> سؤال جديد
              </button>
            </div>
            <p role="status" aria-live="polite" className="mb-3 text-sm text-gold">
              {savedMessage}
            </p>
            <div
              className={`grid items-start gap-6 ${
                edit ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]' : ''
              }`}
            >
              <section className={`min-w-0 ${edit ? 'hidden lg:block' : ''}`}>
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <label className="relative sm:col-span-1">
                    <Search
                      size={17}
                      className="pointer-events-none absolute start-3 top-4 text-ivory/40"
                    />
                    <input
                      aria-label="ابحث في الأسئلة"
                      placeholder="ابحث عن سؤال…"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className={`${filterClass} ps-10`}
                    />
                  </label>
                  <select
                    aria-label="تصفية نوع السؤال"
                    className={filterClass}
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                  >
                    <option value="">كل الأنواع</option>
                    {Object.entries(MODE_LABELS).map(([key, name]) => (
                      <option key={key} value={key}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="تصفية الفئة"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className={filterClass}
                  >
                    <option value="">كل الفئات</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3 flex items-center justify-between text-xs text-ivory/55">
                  <span>{toAr(filtered.length)} سؤال</span>
                  <span>٦ خانات لكل فئة</span>
                </div>
                <div
                  className={`space-y-2 ${
                    edit
                      ? 'lg:max-h-[76dvh] lg:overflow-y-auto'
                      : 'grid gap-3 md:grid-cols-2 lg:grid-cols-3 md:space-y-0'
                  }`}
                >
                  {filtered.map((q) => (
                    <button
                      key={q.id}
                      onClick={() => setEdit(q)}
                      className={`glass w-full rounded-2xl p-4 text-start transition hover:border-gold ${
                        q.id === edit?.id ? 'border-gold ring-1 ring-gold' : ''
                      }`}
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <span className="rounded-lg bg-gold/15 px-2 py-1 text-[11px] font-semibold text-gold">
                          {MODE_LABELS[q.type]}
                        </span>
                        <span
                          className={`ms-auto text-[10px] ${
                            q.status === 'PUBLISHED' ? 'text-[#6fd3a0]' : 'text-ivory/45'
                          }`}
                        >
                          {q.status === 'PUBLISHED'
                            ? 'منشور'
                            : q.status === 'DRAFT'
                              ? 'مسودة'
                              : 'مؤرشف'}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm font-semibold leading-6">{q.prompt}</p>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-ivory/50">
                        <span>
                          {CATEGORIES.find((cat) => cat.id === q.categoryId)?.name} · الخانة{' '}
                          {toAr(q.row + 1)}
                        </span>
                        <span className="num">{q.points} نقطة</span>
                      </div>
                    </button>
                  ))}
                </div>
                {!filtered.length && (
                  <div className="rounded-2xl border border-dashed border-white/20 p-10 text-center text-sm text-ivory/55">
                    مفيش أسئلة بالبحث ده
                  </div>
                )}
              </section>
              {edit && (
                <QuestionEditor
                  key={edit.id || 'new'}
                  initial={edit}
                  onClose={() => setEdit(null)}
                  onSaved={(saved) => {
                    setEdit(saved)
                    setSavedMessage('اتحفظ ✓')
                    void reload()
                  }}
                />
              )}
            </div>
            <div className="mt-8 flex gap-2 rounded-2xl border border-gold/25 bg-gold/8 p-4 text-xs leading-6 text-ivory/60">
              <ImagePlus size={18} className="mt-1 shrink-0" />
              <p>
                الصور والأصوات المرفقة أمثلة للتجربة. الكلام المعكوس بصوت صناعي؛ استبدله بتسجيل مصري
                بإذن صاحبه قبل إطلاق المحتوى. الإجابات والأصول متاحة للإدارة فقط قبل الكشف.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
