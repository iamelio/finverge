const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(7).max(20).optional().or(z.literal('').transform(() => undefined)),
  employment: z
    .string()
    .min(2)
    .max(80)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  password: z.string().min(8).max(128),
  accountType: z.enum(['user', 'admin']).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const loanApplicationSchema = z.object({
  amount: z.number().int().min(10000),
  tenure: z.number().int().min(1).max(120),
  income: z.number().int().positive(),
  employment: z.string().min(2).max(80),
  purpose: z.string().min(2).max(80),
  collateral: z.string().max(200).optional().or(z.literal('').transform(() => undefined)),
  notes: z.string().max(500).optional().or(z.literal('').transform(() => undefined)),
});

const statusUpdateSchema = z.object({
  status: z.enum(['Pending', 'Approved', 'Rejected']),
  adminNotes: z.string().max(500).optional(),
});

const adminNoteSchema = z.object({
  adminNotes: z.string().min(2).max(500),
});

function parseOrThrow(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join('; ');
    const err = new Error(message || 'Validation failed');
    err.status = 400;
    throw err;
  }
  return result.data;
}

module.exports = {
  parseOrThrow,
  registerSchema,
  loginSchema,
  loanApplicationSchema,
  statusUpdateSchema,
  adminNoteSchema,
};
