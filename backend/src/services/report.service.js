import Report from '../models/Report.js';
import Property from '../models/Property.js';
import { ApiError } from '../utils/ApiError.js';
import { OPEN_REPORT_STATUSES, PUBLIC_VISIBLE_STATUSES } from '../config/constants.js';

const already = () => new ApiError(409, 'You have already reported this listing. Our team is reviewing it.', { code: 'ALREADY_REPORTED' });

export async function createReport(reporter, propertyId, { reason, description }) {
  const property = await Property.findOne({ _id: propertyId, status: { $in: PUBLIC_VISIBLE_STATUSES } }).select('title owner assignedAgent');
  if (!property) throw ApiError.notFound('Property not found');
  if ([property.owner, property.assignedAgent].some((u) => u && String(u) === String(reporter._id))) throw ApiError.forbidden('You cannot report your own listing');
  if (await Report.exists({ reporter: reporter._id, property: property._id, status: { $in: OPEN_REPORT_STATUSES } })) throw already();
  try {
    await Report.create({ reporter: reporter._id, property: property._id, propertyTitle: property.title, reason, description });
  } catch (err) {
    if (err?.code === 11000) throw already();
    throw err;
  }
  return { reported: true };
}
