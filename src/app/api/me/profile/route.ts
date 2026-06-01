import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/rbac";

const profileSchema = z.object({
  mailingAddressLine1: z.string().trim().max(120).nullish(),
  mailingAddressLine2: z.string().trim().max(120).nullish(),
  mailingCity: z.string().trim().max(80).nullish(),
  mailingState: z.string().trim().max(40).nullish(),
  mailingPostalCode: z.string().trim().max(20).nullish(),
  zelleType: z.enum(["email", "phone"]).nullish(),
  zelleValue: z.string().trim().max(120).nullish(),
});

function normalizeOptional(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function GET() {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      name: true,
      mailingAddressLine1: true,
      mailingAddressLine2: true,
      mailingCity: true,
      mailingState: true,
      mailingPostalCode: true,
      zelleType: true,
      zelleValue: true,
      policyAcceptedAt: true,
      policyVersion: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

export async function PATCH(request: Request) {
  let userId = "";
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = profileSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  if ((body.data.zelleType && !body.data.zelleValue) || (!body.data.zelleType && body.data.zelleValue)) {
    return NextResponse.json(
      { error: "Zelle type and value must be provided together" },
      { status: 400 }
    );
  }

  const [user] = await db
    .update(users)
    .set({
      mailingAddressLine1: normalizeOptional(body.data.mailingAddressLine1),
      mailingAddressLine2: normalizeOptional(body.data.mailingAddressLine2),
      mailingCity: normalizeOptional(body.data.mailingCity),
      mailingState: normalizeOptional(body.data.mailingState),
      mailingPostalCode: normalizeOptional(body.data.mailingPostalCode),
      zelleType: body.data.zelleType ?? null,
      zelleValue: normalizeOptional(body.data.zelleValue),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      mailingAddressLine1: users.mailingAddressLine1,
      mailingAddressLine2: users.mailingAddressLine2,
      mailingCity: users.mailingCity,
      mailingState: users.mailingState,
      mailingPostalCode: users.mailingPostalCode,
      zelleType: users.zelleType,
      zelleValue: users.zelleValue,
      policyAcceptedAt: users.policyAcceptedAt,
      policyVersion: users.policyVersion,
    });

  return NextResponse.json(user);
}
