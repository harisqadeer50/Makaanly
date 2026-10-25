import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import { isProd } from '../config/env.js';

// Every error becomes { success:false, message, code, errors? }.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong on our side. Please try again.';
  let errors;

  if (err instanceof ApiError) {
    ({ status, code, message } = err);
    errors = err.details;
  } else if (err instanceof ZodError) {
    status = 422; code = 'VALIDATION_ERROR'; message = 'Please check the highlighted fields';
    errors = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 422; code = 'VALIDATION_ERROR'; message = 'Please check the highlighted fields';
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400; code = 'BAD_REQUEST'; message = `Invalid ${err.path}`;
  } else if (err?.code === 11000) {
    status = 409; code = 'CONFLICT';
    message = `That ${Object.keys(err.keyPattern || {})[0] || 'value'} is already in use`;
  } else if (err?.type === 'entity.parse.failed') {
    status = 400; code = 'BAD_REQUEST'; message = 'Malformed JSON body';
  }

  if (status >= 500) console.error(err);
  res.status(status).json({
    success: false, code, message,
    ...(errors ? { errors } : {}),
    ...(!isProd && status >= 500 ? { stack: err.stack } : {}),
  });
}
