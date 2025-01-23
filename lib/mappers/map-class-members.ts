import { ClassMemberRole } from "@prisma/client"

export interface ClassMember {
  tutors: {
    userId: string
    role: ClassMemberRole
    user: {
      name: string
      image: string
    }
  }[]
  students: {
    userId: string
    role: ClassMemberRole
    user: {
      name: string
      image: string
    }
  }[]
}

export interface Member {
  userId: string
  role: ClassMemberRole
  user: {
    name: string
    image: string
  }
}

export function mapClassMembers(members: Member[]): ClassMember {
  const tutors = members.filter((member) => member.role === "OWNER" || member.role === "CO_OWNER");
  const students = members.filter((member) => member.role === "MEMBER");

  return { tutors, students };
}
