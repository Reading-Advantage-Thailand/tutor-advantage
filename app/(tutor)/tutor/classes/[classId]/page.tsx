import React from "react"

import { formatDate } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import CardMessage, { CardMessageProps } from "@/components/tutor/card-message"

const data: CardMessageProps["data"] = {
  from: {
    name: "shadcn",
    avatar: "/avatars/shadcn.jpg",
  },
  createdAt: "2021-09-23T12:00:00Z",
  message: "ดูวิดีโอสอนเพื่อเรียนรู้วิธีการใช้งานเบื้องต้น...",
  videoUrl: "https://www.youtube.com/embed/yKNxeF4KMsY?si=ArBPKw1OshJESs6D", // Video URL
  reactions: [
    { type: "cool", count: 22 },
    { type: "love", count: 22 },
  ],
}

interface ClassContentProps {
  title: string
  content: {
    time: number
    blocks: Block[]
  }
}

interface Block {
  id: string
  type: string
  data: {
    text?: string
    style?: string
    items?: string[]
    link?: string
    meta?: Record<string, string>
  }
}

const classContent = {
  title: "Study Tips",
  content: {
    time: 1735099045798,
    blocks: [
      {
        id: "-hnAAvGDZI",
        type: "paragraph",
        data: {
          text: "Studying doesn’t have to feel overwhelming if you approach it strategically. One effective method is the Pomodoro Technique, where you focus for 25 minutes and then take a 5-minute break to recharge. Eliminating distractions such as social media can significantly enhance your focus. Additionally, consider using active recall—testing yourself on the material—and spaced repetition, which involves reviewing content over increasing intervals. Both techniques are scientifically proven to improve memory retention. If group learning motivates you, join a study group to exchange ideas and clarify concepts.",
        },
      },
      {
        id: "odgmRfAGn3",
        type: "list",
        data: {
          style: "ordered",
          items: [
            "Research Paper (Jan 10, 2024): Be sure to reference at least five academic sources and follow the provided format guidelines.",
            "Presentation Slides (Jan 15, 2024): Ensure slides are concise and visually engaging. Rehearsals will be held on Jan 14.<br>",
            "Quiz (Jan 18, 2024): The quiz will cover Chapters 3–5. Review your notes and the provided study materials in advance.<br>",
          ],
        },
      },
      {
        id: "ILI5ZzRGz7",
        type: "paragraph",
        data: {
          text: "Full details and grading rubrics are available in the syllabus here:",
        },
      },
      {
        id: "sztAT09-3n",
        type: "linkTool",
        data: {
          link: "https://www.classroomassignments.com/schedule2024",
          meta: {},
        },
      },
    ],
  },
}

export default function TutorClassesPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pb-[10rem]">
      <CardMessage data={data} />
      <Card className="max-w-3xl mx-auto w-full">
        <CardContent>
          <h1 className="pt-10 pb-1 w-full resize-none appearance-none overflow-hidden bg-transparent text-5xl font-bold focus:outline-none">
            {classContent.title}
          </h1>
          {classContent.content.blocks.map((block) => (
            <div key={block.id} className="mb-4">
              {render(block)}
            </div>
          ))}
        </CardContent>
        <CardFooter>
          <div className="flex items-center space-x-4">
            <Avatar>
              <AvatarImage src="/avatars/01.png" alt="Image" />
              <AvatarFallback>P</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium leading-none">
                Passakorn Puttama
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDate(new Date().toISOString())}
              </p>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

function render(block: Block) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className="ce-paragraph py-1">
          {block.data.text?.replaceAll("<br>", " ")}
        </p>
      )
    case "list":
      return block.data.style === "ordered" ? (
        <ol className="list-decimal ml-8">
          {block.data.items?.map((item, index) => (
            <li className="pb-2" key={index}>
              {item.replaceAll("<br>", " ")}
            </li>
          ))}
        </ol>
      ) : (
        <ul className="list-disc ml-8">
          {block.data.items?.map((item, index) => (
            <li className="pb-2" key={index}>
              {item.replaceAll("<br/>", " ")}
            </li>
          ))}
        </ul>
      )
    case "linkTool":
      return (
        <a
          href={block.data.link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 underline"
        >
          {block.data.link}
        </a>
      )
    default:
      return <div>Unsupported block type: {block.type}</div>
  }
}
