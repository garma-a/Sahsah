// The approved promo ticker. Two copies of the track scroll by half their width, so the loop is seamless.
// With reduced motion the track stops and the first copy wraps as a static line.
const items = [
  "خصم ٢٠٪ على كل الهدايا",
  "تابعونا على السوشلز @sa7sa7",
  "من الاهرامات للمهرجانات",
  "شاركو بيج الكوميونيتي على",
];

function Track({ hidden }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center whitespace-nowrap motion-reduce:flex-wrap motion-reduce:justify-center">
      {items.map((item) => (
        <li key={item} className="flex items-center">
          <bdi>{item}</bdi>
          <span aria-hidden className="mx-6 tracking-[0.35em] opacity-80 sm:mx-10">
            ------
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function Ticker() {
  return (
    <div
      aria-label="إعلانات صحصح"
      className="relative z-20 overflow-hidden border-b-[3px] border-cyan bg-press py-2.5 text-[0.95rem] font-medium text-white"
    >
      <div className="flex w-max animate-ticker motion-reduce:w-full motion-reduce:animate-none">
        <Track />
        <span className="contents motion-reduce:hidden">
          <Track hidden />
        </span>
      </div>
    </div>
  );
}
