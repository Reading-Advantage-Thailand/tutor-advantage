import { NextRequest, NextResponse } from 'next/server'
import * as Ably from "ably";
import { env } from '@/env.mjs';

export async function POST(req: NextRequest) {
  const clientId = ((await req.formData()).get('clientId')?.toString()) || process.env.DEFAULT_CLIENT_ID || "NO_CLIENT_ID";
  const client = new Ably.Rest(env.ABLY_API_KEY);
  const tokenRequestData = await client.auth.createTokenRequest({ clientId: clientId });
  console.log(tokenRequestData)
  return NextResponse.json(tokenRequestData)
}