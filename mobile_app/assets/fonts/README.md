# Fonts

The website's faces (`web_app/frontend/src/app/layout.tsx`), so the app and
the site read the same. All three are licensed under the
[SIL Open Font License 1.1](https://openfontlicense.org); the licence texts
sit beside the files.

| Family | Weights | Use |
| --- | --- | --- |
| Lalezar | 400 | Headings and numbers (`AppText.display`, `AppText.num`) |
| Alexandria | 400–700 | Body text (`AppText.sans`) |
| Rakkas | 400 | Poster titles (`AppText.poster`) |

Alexandria ships from Google Fonts as one variable font. The four static
weights here were cut from it with fontTools, so Flutter picks a weight by
`FontWeight` alone:

    python -m fontTools.varLib.instancer "Alexandria[wght].ttf" wght=700 -o Alexandria-Bold.ttf
