import { env } from "@/env.mjs"
import * as Ably from "ably"

export async function POST(req: Request) {
  const client = new Ably.Rest(env.ABLY_API_KEY)

  const channel = client.channels.get('status-updates')
  const message: { text: string } = await req.json()

  // By publishing via the serverless function you can perform
  // checks in a trusted environment on the data being published
  const disallowedWords = ['foo', 'bar', 'fizz', 'buzz']

  const containsDisallowedWord = disallowedWords.some(word => {
    return message.text.match(new RegExp(`\\b${word}\\b`))
  })

  if (containsDisallowedWord) {
    return new Response("", { 'status': 403 });
  }

  await channel.publish('update-from-server', message)
  return new Response("");
}