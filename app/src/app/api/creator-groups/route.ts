import { NextResponse } from "next/server";
import { repo } from "@/db/repositories";
import { z } from "zod";

const CreateSchema = z.object({
  name: z.string().min(1),
  canonicalUsername: z.string().min(1),
  avatarUrl: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  creatorIds: z.array(z.string()).optional().default([]),
});

const UpdateSchema = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  canonicalUsername: z.string().min(1).optional(),
  avatarUrl: z.string().optional(),
  notes: z.string().optional(),
  creatorIds: z.array(z.string()).optional(),
});

export async function GET() {
  const [groups, creators] = await Promise.all([
    repo.creatorGroups.list(),
    repo.creators.list(),
  ]);
  // Include creators per group
  const groupsWithCreators = groups.map((g) => ({
    ...g,
    creators: creators.filter((c) => c.groupId === g.id),
  }));
  return NextResponse.json(groupsWithCreators);
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const group = await repo.creatorGroups.create({
    name: parsed.data.name,
    canonicalUsername: parsed.data.canonicalUsername,
    avatarUrl: parsed.data.avatarUrl,
    notes: parsed.data.notes,
  });
  // Link creators to group
  for (const cid of parsed.data.creatorIds) {
    await repo.creators.update(cid, { groupId: group.id });
  }
  return NextResponse.json(group, { status: 201 });
}

export async function PUT(request: Request) {
  const body = await request.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { id, creatorIds, ...updates } = parsed.data;
  await repo.creatorGroups.update(id, updates);
  if (creatorIds) {
    // Unlink existing creators not in new list
    const allCreators = await repo.creators.list();
    for (const c of allCreators.filter((c) => c.groupId === id)) {
      if (!creatorIds.includes(c.id)) {
        await repo.creators.update(c.id, { groupId: null });
      }
    }
    // Link new creators
    for (const cid of creatorIds) {
      await repo.creators.update(cid, { groupId: id });
    }
  }
  const updated = await repo.creatorGroups.get(id);
  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await repo.creatorGroups.delete(id);
  return NextResponse.json({ success: true });
}
