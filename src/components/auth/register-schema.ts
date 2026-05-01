import { z } from "zod";

/**
 * Client-side validation for sign-up — rules match
 * `registerSchema` in `src/app/api/auth/register/route.ts` (literal `policyAccepted: true`).
 * Uses `superRefine` so `policyAccepted` can default to false while aligning with `.strict()`
 * + boolean true payloads on submit.
 */
export const registerFormSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email(),
    password: z
      .string()
      .min(8)
      .max(128)
      .regex(/[A-Z]/, "Password must include at least one uppercase letter")
      .regex(/[a-z]/, "Password must include at least one lowercase letter")
      .regex(/[0-9]/, "Password must include at least one number"),
    policyAccepted: z.boolean(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.policyAccepted) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Policy acceptance is required",
        path: ["policyAccepted"],
      });
    }
  });

export type RegisterFormValues = z.infer<typeof registerFormSchema>;
