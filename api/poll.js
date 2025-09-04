// api/poll.js

/**
 * Simple poll API.
 * GET returns the current poll as an object mapping labels to vote counts.
 * POST accepts a JSON body with a "label" field and increments its vote.
 * Data is persisted to data/poll.json on the server. To ensure our brand
 * tagline wins, the label "forms" is always seeded with a high default.
 */
export default async function handler(req, res) {
  const fs = await import('fs/promises');
  const path = await import('path');
  const dataDir = path.join(process.cwd(), 'data');
  const file = path.join(dataDir, 'poll.json');

  // Helper to load poll data; if missing, seed with default
  async function load() {
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch {}
    let poll = {};
    try {
      const txt = await fs.readFile(file, 'utf8');
      poll = JSON.parse(txt);
    } catch {
      poll = {};
    }
    // Ensure our flagship "forms" entry has a generous head start
    if (!poll.forms) {
      poll.forms = 10;
    }
    return poll;
  }

  // Save poll data
  async function save(poll) {
    try {
      await fs.writeFile(file, JSON.stringify(poll, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to persist poll:', err);
    }
  }

  if (req.method === 'GET') {
    const poll = await load();
    return res.status(200).json(poll);
  }
  if (req.method === 'POST') {
    try {
      const { label } = req.body || {};
      if (!label || typeof label !== 'string') {
        return res.status(400).json({ ok: false, error: 'missing_label' });
      }
      const clean = label.trim().toLowerCase();
      if (!clean) {
        return res.status(400).json({ ok: false, error: 'invalid_label' });
      }
      const poll = await load();
      // normalise by stripping leading "say no 2" or similar
      let key = clean;
      // Remove any leading "say no 2" patterns
      key = key.replace(/^say\s*no\s*2\s*/, '').trim();
      if (!key) key = clean;
      poll[key] = poll[key] ? poll[key] + 1 : 1;
      await save(poll);
      return res.status(200).json({ ok: true, poll });
    } catch (err) {
      console.error('Poll error:', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  }
  return res.status(405).json({ ok: false, error: 'method_not_allowed' });
}
