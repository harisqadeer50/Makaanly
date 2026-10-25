// Consistent JSON envelope: { success: true, data, meta? }
export function ok(res, data = null, meta, status = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

export const created = (res, data, meta) => ok(res, data, meta, 201);

export function paginationMeta({ page, limit, total }) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
