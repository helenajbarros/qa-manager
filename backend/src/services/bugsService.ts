import { query, execute } from "../database/connection";
import * as notif from "./notificationsService";
import path from "path";
import fs   from "fs";

async function extractModuleId(title: string): Promise<number | null> {
  const match = title.match(/^\[(.+?)\]/);
  if (!match) return null;
  const rows = await query<{id: number}>("SELECT id FROM modules WHERE LOWER(name) = $1", [match[1].trim().toLowerCase()]);
  return rows[0]?.id ?? null;
}

const BASE_Q = `
  SELECT b.*, m.name AS module_name, u.name AS created_by_name, a.name AS assigned_to_name,
    tc.title AS test_case_title,
    pe.name AS environment_name, pe.color AS environment_color,
    (SELECT cyc.status FROM test_executions tex JOIN test_cycles cyc ON cyc.id = tex.cycle_id
     WHERE tex.bug_id = b.id ORDER BY cyc.created_at DESC LIMIT 1) AS cycle_status
  FROM bugs b
  LEFT JOIN modules m ON m.id = b.module_id LEFT JOIN users u ON u.id = b.created_by_id
  LEFT JOIN users a ON a.id = b.assigned_to_id LEFT JOIN test_cases tc ON tc.id = b.test_case_id
  LEFT JOIN project_environments pe ON pe.id = b.environment_id
`;

async function getFiles(bug_id: number | string) {
  return query("SELECT * FROM evidence_files WHERE ref_type='bug' AND ref_id=$1 ORDER BY created_at", [bug_id]);
}

async function getRelations(bug_id: number | string) {
  return query(`SELECT br.id, br.related_bug_id, b.title, b.status, b.severity, m.name AS module_name
    FROM bug_relations br JOIN bugs b ON b.id = br.related_bug_id LEFT JOIN modules m ON m.id = b.module_id
    WHERE br.bug_id = $1`, [bug_id]);
}

async function attachAll(bug: any) {
  if (!bug) return undefined;
  const [files, relations] = await Promise.all([getFiles(bug.id), getRelations(bug.id)]);
  return { ...bug, evidence_files: files, related_bugs: relations };
}

export async function findAll({ status, severity, module_id, project_id, search, page, limit, cycle_id }: any = {}) {
  const conds = ["1=1"]; const params: unknown[] = [];
  if (project_id) { params.push(project_id); conds.push(`b.project_id = $${params.length}`); }
  if (status)     { params.push(status);      conds.push(`b.status = $${params.length}`); }
  if (severity)   { params.push(severity);    conds.push(`b.severity = $${params.length}`); }
  if (module_id)  { params.push(module_id);   conds.push(`b.module_id = $${params.length}`); }
  if (search)     { params.push(`%${search.toLowerCase()}%`); conds.push(`LOWER(b.title) LIKE $${params.length}`); }
  if (cycle_id === "no_cycle") {
    conds.push(`b.id NOT IN (SELECT DISTINCT bug_id FROM test_executions WHERE bug_id IS NOT NULL)`);
  } else if (cycle_id) {
    params.push(cycle_id); conds.push(`b.id IN (SELECT DISTINCT bug_id FROM test_executions WHERE cycle_id = $${params.length} AND bug_id IS NOT NULL)`);
  }
  const where    = conds.join(" AND ");
  const pageNum  = Math.max(1, parseInt(page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 50));
  const offset   = (pageNum - 1) * pageSize;
  const countRows = await query<{total: string}>(`SELECT COUNT(*) AS total FROM bugs b WHERE ${where}`, params);
  const total = parseInt(countRows[0]?.total || "0");
  params.push(pageSize); const limitIdx  = params.length;
  params.push(offset);   const offsetIdx = params.length;
  const rows = await query(`${BASE_Q} WHERE ${where} ORDER BY b.created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`, params);
  const data = await Promise.all(rows.map(attachAll));
  return { data, total, page: pageNum, limit: pageSize, pages: Math.ceil(total / pageSize) };
}

export async function findById(id: number | string) {
  const rows = await query(`${BASE_Q} WHERE b.id=$1`, [id]);
  return attachAll(rows[0]);
}

export async function logActivity(bug_id: number | string, user_id: number | null, action: string, detail: string | null): Promise<void> {
  try { await query("INSERT INTO bug_activity (bug_id, user_id, action, detail) VALUES ($1,$2,$3,$4)", [bug_id, user_id || null, action, detail || null]); }
  catch(_) {}
}

export async function getActivity(bug_id: number | string) {
  return query(`SELECT ba.*, u.name AS user_name FROM bug_activity ba LEFT JOIN users u ON u.id = ba.user_id WHERE ba.bug_id = $1 ORDER BY ba.created_at ASC`, [bug_id]);
}

export async function create(data: any) {
  const { title, description, comment, tracker_url, severity, priority, status,
    module_id, test_case_id, created_by_id, project_id, assigned_to_id, pr_url, steps,
    environment, actual_result, expected_result, os, browser, impact, evidence_url } = data;
  const mod = module_id || await extractModuleId(title);
  const { environment_id } = data;
  const rows = await query<{id: number}>(`INSERT INTO bugs (title,description,comment,tracker_url,severity,priority,status,module_id,test_case_id,created_by_id,project_id,assigned_to_id,pr_url,steps,closed_by_archive,environment,environment_id,actual_result,expected_result,os,browser,impact,evidence_url,version) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING id`,
    [title.trim(), description||null, comment||null, tracker_url||null, severity||"medium", priority||"medium", status||"open", mod||null, test_case_id||null, created_by_id||null, project_id||1, assigned_to_id||null, pr_url||null, steps||null, false, environment||null, environment_id||null, actual_result||null, expected_result||null, os||null, browser||null, impact||null, evidence_url||null, data.version||null]);
  const bug = await findById(rows[0].id);
  await logActivity(rows[0].id, created_by_id, "criou o bug", null);
  return bug;
}

export async function update(id: number | string, data: any, userId?: number) {
  const { title, description, comment, tracker_url, severity, priority, status,
    module_id, test_case_id, assigned_to_id, pr_url, steps, test_type,
    environment, actual_result, expected_result, closed_by_archive,
    os, browser, impact, evidence_url } = data;
  const prev = await findById(id) as any;
  const mod  = module_id || await extractModuleId(title);
  const archiveVal = closed_by_archive === true ? true : closed_by_archive === false ? false : prev?.closed_by_archive || false;
  const environment_id2 = data.environment_id;
  await execute(`UPDATE bugs SET title=$1,description=$2,comment=$3,tracker_url=$4,severity=$5,priority=$6,status=$7,module_id=$8,test_case_id=$9,assigned_to_id=$10,pr_url=$11,steps=$12,test_type=$13,environment=$14,environment_id=$15,actual_result=$16,expected_result=$17,closed_by_archive=$18,os=$19,browser=$20,impact=$21,evidence_url=$22,version=$23 WHERE id=$24`,
    [title.trim(), description||null, comment||null, tracker_url||null, severity||"medium", priority||"medium", status||"open", mod||null, test_case_id||null, assigned_to_id||null, pr_url||null, steps||null, test_type||null, environment||null, environment_id2||null, actual_result||null, expected_result||null, archiveVal, os||null, browser||null, impact||null, evidence_url||null, data.version||null, id]);
  if (prev) {
    if (prev.status !== status) await logActivity(id, userId ?? null, "alterou o status", `${prev.status} → ${status}`);
    if (prev.assigned_to_id !== (assigned_to_id || null)) {
      await logActivity(id, userId ?? null, "alterou o responsável", null);
      if (assigned_to_id && assigned_to_id !== userId) {
        const bug = await findById(id) as any;
        await notif.create({ user_id: assigned_to_id, type: "assigned", message: `Você foi atribuído como responsável pelo bug #${id}: "${bug?.title}"`, link: `/bugs/${id}` });
      }
    }
    if (prev.title !== title) await logActivity(id, userId ?? null, "editou o bug", null);
    if (prev.closed_by_archive !== archiveVal)
      await logActivity(id, userId ?? null, archiveVal ? "arquivou o bug" : "desarquivou o bug", null);
  }
  return findById(id);
}

export async function addRelation(bugId: number | string, relatedBugId: number | string) {
  try {
    await query("INSERT INTO bug_relations (bug_id, related_bug_id) VALUES ($1,$2)", [bugId, relatedBugId]);
    await query("INSERT INTO bug_relations (bug_id, related_bug_id) VALUES ($1,$2)", [relatedBugId, bugId]);
  } catch(_) {}
  return getRelations(bugId);
}

export async function removeRelation(bugId: number | string, relatedBugId: number | string) {
  await execute("DELETE FROM bug_relations WHERE bug_id=$1 AND related_bug_id=$2", [bugId, relatedBugId]);
  await execute("DELETE FROM bug_relations WHERE bug_id=$1 AND related_bug_id=$2", [relatedBugId, bugId]);
  return getRelations(bugId);
}

export async function addFile(bug_id: number | string, file: Express.Multer.File) {
  await execute("INSERT INTO evidence_files (ref_type,ref_id,filename,originalname,mimetype,size) VALUES ('bug',$1,$2,$3,$4,$5)",
    [bug_id, file.filename, file.originalname, file.mimetype, file.size]);
  return getFiles(bug_id);
}

export async function removeFile(bug_id: number | string, file_id: number | string) {
  const rows = await query<any>("SELECT * FROM evidence_files WHERE id=$1 AND ref_type='bug' AND ref_id=$2", [file_id, bug_id]);
  if (rows[0]) {
    const full = path.resolve(process.env.QA_UPLOAD_DIR || "uploads", rows[0].filename);
    if (fs.existsSync(full)) fs.unlinkSync(full);
    await execute("DELETE FROM evidence_files WHERE id=$1", [file_id]);
  }
  return getFiles(bug_id);
}

export async function remove(id: number | string) {
  return execute("DELETE FROM bugs WHERE id=$1", [id]);
}