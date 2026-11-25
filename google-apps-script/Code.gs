/**
 * BETMA ENGLISH - Google Sheets receiver
 * Deploy as Web App: Execute as Me; access Anyone.
 * The receiver appends rows only. It never overwrites historical submissions.
 */
const CONFIG = {
  SPREADSHEET_ID: 'PASTE_GOOGLE_SPREADSHEET_ID_HERE',
  SHEETS: {
    STUDENT: 'STUDENT',
    LEADS: 'LEADS',
    PRACTICE: 'PRACTICE_HISTORY',
    MOCK: 'MOCK_TEST_RESULT',
    ANSWERS: 'ANSWER_DETAIL',
    WRITING: 'WRITING_SPEAKING'
  }
};

const HEADERS = {
  STUDENT: ['Student_ID', 'Full_Name', 'Email', 'Phone', 'First_Seen_At'],
  LEADS: ['Submission_ID', 'Full_Name', 'Phone', 'Created_At'],
  PRACTICE_HISTORY: ['Submission_ID', 'Student_ID', 'Full_Name', 'Email', 'Phone', 'Skill', 'Part', 'Exercise_ID', 'Total_Questions', 'Correct_Answers', 'Accuracy_Percent', 'Submitted_At'],
  MOCK_TEST_RESULT: ['Submission_ID', 'Student_ID', 'Full_Name', 'Email', 'Phone', 'Test_ID', 'Test_Name', 'Started_At', 'Submitted_At', 'Duration_Seconds', 'Grammar_Raw_Score', 'Listening_Score_50', 'Reading_Score_50', 'Writing_Status', 'Speaking_Status', 'Total_Score'],
  ANSWER_DETAIL: ['Submission_ID', 'Student_ID', 'Test_ID_or_Exercise_ID', 'Section', 'Question_ID', 'Student_Answer', 'Correct_Answer', 'Is_Correct', 'Recorded_At'],
  WRITING_SPEAKING: ['Submission_ID', 'Student_ID', 'Full_Name', 'Test_ID', 'Section', 'Question_ID', 'Response_or_Recording_Status', 'Review_Status', 'Score', 'Teacher_Feedback', 'Submitted_At']
};

function setupSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  ensureSheets_(ss);
  return 'BETMA sheets are ready';
}

function doGet() {
  return HtmlService.createHtmlOutput('<!doctype html><html><body>BETMA ENGLISH Sheets API is running.</body></html>');
}

function doPost(e) {
  let payload = {};
  let result;
  try {
    const raw = e && e.parameter && e.parameter.payload;
    if (!raw) throw new Error('Missing payload');
    payload = JSON.parse(raw);
    const lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      result = handlePayload_(payload);
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    result = { success: false, error: String(err && err.message || err) };
  }
  return ackPage_(payload.client_nonce || '', result || { success: false, error: 'Unknown error' });
}

function handlePayload_(p) {
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID.indexOf('PASTE_') === 0) throw new Error('Configure SPREADSHEET_ID in Code.gs');
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  ensureSheets_(ss);
  const type = String(p.type || '');
  const id = String(p.submission_id || '');
  if (!id) throw new Error('submission_id is required');

  if (type === 'student') {
    const st = p.student || {};
    const sh = ss.getSheetByName(CONFIG.SHEETS.STUDENT);
    const studentId = String(st.student_id || '');
    if (!studentId) throw new Error('student_id is required');
    if (existsInColumn_(sh, 1, studentId)) return { success: true, duplicate: true, type: type, id: id };
    sh.appendRow([safe_(studentId), safe_(st.full_name), safe_(st.email), safe_(st.phone), new Date()]);
    return { success: true, type: type, id: id };
  }

  if (type === 'lead') {
    const sh = ss.getSheetByName(CONFIG.SHEETS.LEADS);
    if (existsInColumn_(sh, 1, id)) return { success: true, duplicate: true, type: type, id: id };
    sh.appendRow([safe_(id), safe_(p.full_name), safe_(p.phone), safeDate_(p.created_at)]);
    return { success: true, type: type, id: id };
  }

  if (type === 'practice') {
    const sh = ss.getSheetByName(CONFIG.SHEETS.PRACTICE);
    if (existsInColumn_(sh, 1, id)) { appendAnswers_(ss, p, id, p.exercise_id || ''); return { success: true, duplicate: true, type: type, id: id }; }
    sh.appendRow([
      safe_(id), safe_(p.student_id), safe_(p.full_name), safe_(p.email), safe_(p.phone),
      safe_(p.skill), Number(p.part || 0), safe_(p.exercise_id), Number(p.total_questions || 0),
      Number(p.correct_answers || 0), Number(p.accuracy || 0), safeDate_(p.submitted_at)
    ]);
    appendAnswers_(ss, p, id, p.exercise_id || '');
    return { success: true, type: type, id: id };
  }

  if (type === 'mock') {
    const sh = ss.getSheetByName(CONFIG.SHEETS.MOCK);
    if (existsInColumn_(sh, 1, id)) { appendAnswers_(ss, p, id, p.test_id || ''); appendWriting_(ss, p, id); return { success: true, duplicate: true, type: type, id: id }; }
    sh.appendRow([
      safe_(id), safe_(p.student_id), safe_(p.full_name), safe_(p.email), safe_(p.phone),
      safe_(p.test_id), safe_(p.test_name), safeDate_(p.started_at), safeDate_(p.submitted_at),
      Number(p.total_time || 0), safe_(p.grammar_score), safe_(p.listening_score), safe_(p.reading_score),
      safe_(p.writing_status), safe_(p.speaking_status), safe_(p.total_score)
    ]);
    appendAnswers_(ss, p, id, p.test_id || '');
    appendWriting_(ss, p, id);
    return { success: true, type: type, id: id };
  }
  throw new Error('Unsupported payload type: ' + type);
}

function ensureSheets_(ss) {
  const names = [CONFIG.SHEETS.STUDENT, CONFIG.SHEETS.LEADS, CONFIG.SHEETS.PRACTICE, CONFIG.SHEETS.MOCK, CONFIG.SHEETS.ANSWERS, CONFIG.SHEETS.WRITING];
  names.forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      const key = Object.keys(CONFIG.SHEETS).find(k => CONFIG.SHEETS[k] === name);
      const headerKey = key === 'PRACTICE' ? 'PRACTICE_HISTORY' : key === 'MOCK' ? 'MOCK_TEST_RESULT' : key === 'ANSWERS' ? 'ANSWER_DETAIL' : key === 'WRITING' ? 'WRITING_SPEAKING' : key;
      sh.getRange(1, 1, 1, HEADERS[headerKey].length).setValues([HEADERS[headerKey]]);
      sh.setFrozenRows(1);
    }
  });
}

function appendAnswers_(ss, p, submissionId, referenceId) {
  const answers = Array.isArray(p.answers) ? p.answers : [];
  if (!answers.length) return;
  const sh = ss.getSheetByName(CONFIG.SHEETS.ANSWERS);
  const existing = existingQuestionKeys_(sh, submissionId, 5);
  const rows = answers.filter(a => !existing.has(String(a.question_id))).map(a => [
    safe_(submissionId), safe_(p.student_id), safe_(referenceId), safe_(a.section), safe_(a.question_id),
    safe_(a.student_answer), safe_(a.correct_answer), a.is_correct === '' || a.is_correct === null || a.is_correct === undefined ? '' : Boolean(a.is_correct), new Date()
  ]);
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function existingQuestionKeys_(sheet, submissionId, questionColumn) {
  const last = sheet.getLastRow();
  const found = new Set();
  if (last < 2) return found;
  sheet.getRange(2, 1, last - 1, questionColumn).getDisplayValues().forEach(r => {
    if (r[0] === String(submissionId)) found.add(r[questionColumn - 1]);
  });
  return found;
}

function appendWriting_(ss, p, submissionId) {
  const items = Array.isArray(p.writing_speaking) ? p.writing_speaking : [];
  if (!items.length) return;
  const sh = ss.getSheetByName(CONFIG.SHEETS.WRITING);
  const existing = existingQuestionKeys_(sh, submissionId, 6);
  const rows = items.filter(x => !existing.has(String(x.question_id))).map(x => [
    safe_(submissionId), safe_(p.student_id), safe_(p.full_name), safe_(p.test_id), safe_(x.section), safe_(x.question_id),
    safe_(x.response), safe_(x.status || 'Pending Review'), '', '', safeDate_(p.submitted_at)
  ]);
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function existsInColumn_(sheet, col, value) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  return sheet.getRange(2, col, last - 1, 1).getDisplayValues().some(r => r[0] === String(value));
}

function safe_(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  // Prevent user-submitted text from being interpreted as a spreadsheet formula.
  return /^[=+@\-]/.test(s) ? "'" + s : s;
}

function safeDate_(v) {
  if (!v) return new Date();
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date() : d;
}

function ackPage_(nonce, result) {
  const data = JSON.stringify({ source: 'BETMA_SHEETS', client_nonce: String(nonce), ...result }).replace(/</g, '\\u003c');
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><script>window.top.postMessage(' + data + ', "*");</script>BETMA sync response</body></html>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
