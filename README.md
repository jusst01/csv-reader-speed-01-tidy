# csv-reader-speed-01-tidy

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/jusst01/csv-reader-speed-01-tidy/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/jusst01/csv-reader-speed-01-tidy/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for csv-reader 1.0.0, built on physical lines. `solve.js` exports `run(input)`, which
returns csv-reader's exact reading of the input `{text, header}` — the JSON value
`{columns, rows, errors}` — and `main.ts` is the harness driver that reads every case from
`/input/cases.json`, answers each with `run`, and writes `/output/answers.json`.

The text is split into lines once; records are then read line by line with a cursor, and a quoted field
that has not closed by the end of its line pulls the next line in. The reference's broken-row policy is
kept exactly:

- a U+FEFF at the very start is dropped; a record ends at LF or CRLF; a line left with no characters is no record;
- outside quotes a CR not followed by LF is dropped (`stray_cr`) — a CR at a line's very end is the CRLF
  ending instead, which the line split makes a one-comparison test;
- a quoted field runs to the next quote that is not doubled (`""` inside it is one quote; each CRLF or lone CR
  inside it reads as LF); what follows its closing quote, up to the next comma or line break, is appended as it
  stands (`quote_junk` when the field ends); a quote that never closes is a literal character and the text after
  it is read again as unquoted (`unterminated_quote`) — the cursor returns to the line the quote opened on and
  re-reads its remainder as a plain field;
- fields stay strings, never trimmed or converted; `columns` is the first record when `header` is true, else
  null; rows are padded (`short_row`) or cut (`long_row`) to the first record's width; each error is
  `{code, line, row}` in the order met.

Pure JavaScript, no dependencies, no WebAssembly, deterministic: the same input always produces the same answer,
and nothing is kept from one case to the next.

## Run it

```sh
node main.ts
```

Reads `/input/cases.json` and writes `/output/answers.json`; outside a container, `MAKEFUN_INPUT_DIR` and
`MAKEFUN_OUTPUT_DIR` stand in for `/input` and `/output`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=qv0n5yca&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
