// csv-reader-speed-01, the tidy entry: a drop-in for csv-reader 1.0.0 built on physical lines.
// The text is split into lines once; records are then read line by line with a cursor, and a
// quoted field that has not closed by the end of its line pulls the next line in. Neither a
// whole-text scanner nor a state machine: the line array is the reader's backbone.
//
// The reading, exactly as the reference makes it: a U+FEFF at the very start is dropped; a record
// ends at LF or CRLF and a line left with no characters is no record; outside quotes a CR not
// followed by LF is dropped (stray_cr); a field that opens with a quote runs to the next quote
// that is not doubled ("" inside it is one quote, each CRLF or lone CR inside it reads as LF),
// what follows its closing quote up to the next comma or line break is appended as it stands
// (quote_junk when the field ends), and a quote that never closes is a literal character with the
// text after it read again as unquoted (unterminated_quote); a quote inside an unquoted field is
// a literal character; fields stay strings. columns is the first record when header is true, else
// null; rows are padded (short_row) or cut (long_row) to the first record's width; each error is
// {code, line, row} in the order met.

export function run(input) {
  let text = String(input.text);
  const header = input.header === true;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const lines = text.split('\n');
  const lastLine = lines.length - 1; // lines[lastLine] has no LF after it; every earlier line does

  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let li = 0; // the line the cursor is on
  let ci = 0; // the cursor's column in that line
  let line = 1; // the reference's line counter: LFs, and CRs inside quotes, advance it

  let recordLine = 1;
  let recordRow = null;

  const hasTerm = () => li < lastLine; // whether the current line ends with an LF in the text

  function finishRecord(fields, firstQuoted) {
    if (fields.length === 1 && fields[0] === '' && !firstQuoted) return; // no characters: no record
    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      return;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  // Inside quotes a CR reads as LF and advances the line counter; returns the converted slice.
  function quotedSlice(s) {
    if (!s.includes('\r')) return s;
    let out = '';
    let start = 0;
    for (;;) {
      const k = s.indexOf('\r', start);
      if (k === -1) return out + s.slice(start);
      out += s.slice(start, k) + '\n';
      line += 1;
      start = k + 1;
    }
  }

  // Reads an unquoted stretch of the current line from the cursor: to the next comma, to the
  // line's end, or through stray CRs (dropped, one error each). `prefix` is the value so far
  // ('"' after an unterminated quote, the quoted value for post-quote junk); when junkLen is
  // given, a value that outgrows it by the field's end earns a quote_junk error.
  // Returns 'comma', 'line', or 'eof' for how the field ended.
  function readPlain(prefix, junkLen) {
    const s = lines[li];
    let value = prefix;
    for (;;) {
      const comma = s.indexOf(',', ci);
      const cr = s.indexOf('\r', ci);
      if (cr !== -1 && (comma === -1 || cr < comma)) {
        if (cr === s.length - 1 && hasTerm()) {
          // A CR at the line's end, with the LF after it: the record's CRLF ending.
          value += s.slice(ci, cr);
          ci = s.length;
          if (junkLen !== null && value.length > junkLen) {
            errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
          }
          fieldValue = value;
          return 'line';
        }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        value += s.slice(ci, cr);
        ci = cr + 1;
        continue;
      }
      if (comma !== -1) {
        value += s.slice(ci, comma);
        ci = comma + 1;
        if (junkLen !== null && value.length > junkLen) {
          errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
        }
        fieldValue = value;
        return 'comma';
      }
      value += s.slice(ci);
      ci = s.length;
      if (junkLen !== null && value.length > junkLen) {
        errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      }
      fieldValue = value;
      return hasTerm() ? 'line' : 'eof';
    }
  }

  let fieldValue = '';

  // Reads a quoted field whose opening quote is under the cursor.
  // Returns 'comma', 'line', or 'eof' for how the field ended.
  function readQuoted() {
    const openLi = li;
    const openCi = ci;
    const openLineNo = line;
    let value = '';
    ci += 1; // past the opening quote
    let from = ci;
    for (;;) {
      const s = lines[li];
      const q = s.indexOf('"', from);
      if (q === -1) {
        // No closing quote on this line: the field takes the rest of the line and, if the text
        // goes on, the line break itself (a trailing CR is that break's first half), then the
        // next line.
        if (!hasTerm()) {
          // The quote never closes: it is a literal character, and the text after it is read
          // again as unquoted, from the line the quote opened on.
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          li = openLi;
          line = openLineNo;
          ci = openCi + 1;
          return readPlain('"', null);
        }
        if (s.endsWith('\r')) {
          value += quotedSlice(s.slice(from, -1)) + '\n';
        } else {
          value += quotedSlice(s.slice(from)) + '\n';
        }
        line += 1; // the line break the field just crossed
        li += 1;
        ci = 0;
        from = 0;
        continue;
      }
      if (s.charCodeAt(q + 1) === 34) {
        // A doubled quote: one quote in the value, and the field goes on.
        value += quotedSlice(s.slice(from, q)) + '"';
        from = q + 2;
        ci = from;
        continue;
      }
      // The closing quote.
      value += quotedSlice(s.slice(from, q));
      ci = q + 1;
      if (ci >= s.length) {
        fieldValue = value;
        return hasTerm() ? 'line' : 'eof';
      }
      const c = s.charCodeAt(ci);
      if (c === 44) {
        ci += 1;
        fieldValue = value;
        return 'comma';
      }
      if (c === 13 && ci === s.length - 1 && hasTerm()) {
        ci = s.length;
        fieldValue = value;
        return 'line'; // the closing quote is followed by the record's CRLF ending
      }
      // What follows the closing quote is appended as it stands.
      return readPlain(value, value.length);
    }
  }

  for (;;) {
    // Lines with no characters are no records: an empty line, or a bare CRLF.
    while (li <= lastLine) {
      const s = lines[li];
      if (s === '' && hasTerm()) { li += 1; line += 1; continue; }
      if (s === '\r' && hasTerm()) { li += 1; line += 1; continue; }
      break;
    }
    if (li > lastLine) break;
    if (li === lastLine && lines[li] === '' && !hasTerm()) break; // the text is over

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    ci = 0;
    const fields = [];
    let firstQuoted = false;
    let end = 'comma';
    while (end === 'comma') {
      const s = lines[li];
      const quoted = ci < s.length && s.charCodeAt(ci) === 34;
      if (fields.length === 0) firstQuoted = quoted;
      if (quoted) end = readQuoted();
      else {
        end = readPlain('', null);
      }
      fields.push(fieldValue);
    }
    finishRecord(fields, firstQuoted);
    if (end === 'eof') break;
    li += 1; // the line break that ended the record
    line += 1;
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
