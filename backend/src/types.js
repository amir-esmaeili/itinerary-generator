import { z } from "zod";

// Request validation schema
export const RequestSchema = z.object({
  destination: z.string().min(1, "Destination is required"),
  durationDays: z
    .number()
    .int()
    .min(1, "Duration must be at least 1 day")
    .max(30, "Duration cannot exceed 30 days"),
});

// Activity schema
export const ActivitySchema = z.object({
  time: z.enum(["Morning", "Afternoon", "Evening"]),
  description: z.string().min(1, "Description is required"),
  location: z.string().min(1, "Location is required"),
});

// Day schema
export const DaySchema = z.object({
  day: z.number().int().positive(),
  theme: z.string().min(1, "Theme is required"),
  activities: z
    .array(ActivitySchema)
    .min(1, "At least one activity is required"),
});

// Complete itinerary schema
export const ItinerarySchema = z
  .array(DaySchema)
  .min(1, "At least one day is required");

// Firestore document schema
export const FirestoreDocumentSchema = z.object({
  status: z.enum(["processing", "completed", "failed"]),
  destination: z.string(),
  durationDays: z.number().int(),
  createdAt: z.date(),
  completedAt: z.date().nullable(),
  itinerary: ItinerarySchema.nullable(),
  error: z.string().nullable(),
});

// Response schemas
export const JobResponseSchema = z.object({
  jobId: z.string().uuid(),
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});
