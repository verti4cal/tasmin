import { z } from "zod";

export const createDeviceSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1).max(255),
  mqttTopic: z.string().max(255).optional(),
  moduleType: z.string().max(100).optional(),
  firmwareVersion: z.string().max(50).optional(),
  groupId: z.number().int().positive().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateDeviceSchema = createDeviceSchema.partial().extend({
  groupId: z.number().int().positive().nullable().optional(), // null clears the group assignment
  firmwareVersion: z.string().max(50).nullable().optional(), // null clears it (e.g. unverifiable after an OTA push)
});

export const sendCommandSchema = z.object({
  command: z.string().min(1).max(500),
});

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
