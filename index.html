// employees.js  →  GET /api/employees
// Returns the EmployeeMaster tab as objects. Powers the LRM autocomplete + auto-fill,
// and supplies the LRM->TL mapping. Header matching is tolerant (case/space/underscore),
// so "TL Email", "tl_email", "Team Lead Email" all resolve.
const { readSheet, rowsToObjects, pick, json } = require('./_sheets');
const { requireUser, deny } = require('./_auth');

exports.handler = async (event) => {
  const auth = await requireUser(event);
  if (!auth.ok) return deny(auth);
  try {
    const rows = rowsToObjects(await readSheet('EmployeeMaster!A:Z'));
    const emps = rows.map(r => ({
      name: pick(r, ['LRM Name', 'LRM', 'Agent Name', 'Name']),
      email: pick(r, ['LRM Email', 'Agent Email', 'Email']),
      tlName: pick(r, ['TL Name', 'Team Lead Name', 'Team Lead', 'TL']),
      tlEmail: pick(r, ['TL Email', 'Team Lead Email', 'TL Mail']),
      mgrName: pick(r, ['ZSM Name', 'Manager Name', 'ZSM']),
      mgrEmail: pick(r, ['ZSM Email', 'Manager Email']),
      adosName: pick(r, ['ADOS Name', 'ADOS']),
      adosEmail: pick(r, ['ADOS Email']),
    })).filter(e => e.name);
    return json(200, emps);
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};

// --- Vercel adapter: expose the handler as a Vercel serverless function ---
module.exports = require('./_adapter')(exports.handler);
