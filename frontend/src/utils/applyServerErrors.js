// Copies field errors from the API ({errors:[{field,message}]}) onto a react-hook-form instance.
// Returns the message to show at the top of the form when nothing maps to a field.
export function applyServerErrors(err, setError) {
  const fields = Array.isArray(err?.errors) ? err.errors : [];
  let mapped = 0;
  fields.forEach((e) => { if (e.field) { setError(e.field, { type: 'server', message: e.message }); mapped += 1; } });
  return mapped ? null : err?.message || 'Something went wrong. Please try again.';
}

// A readable one-liner for toasts: prefers the first specific field message over the generic summary.
export const errorMessage = (err) => err?.errors?.[0]?.message || err?.message || 'Something went wrong. Please try again.';
