import { ClassMemberStatus, Member } from "@/app/(tutor)/tutor/classes/[id]/members/columns";
import { GetClassMemberResponse } from "@/app/(tutor)/tutor/classes/[id]/members/page";

export function mapToClassMember(
  getClassMemberResponse: GetClassMemberResponse
): Member[] {
  return getClassMemberResponse.students.map((student) => ({
    id: student.user.id,
    name: student.user.name,
    email: student.user.email,
    status: ClassMemberStatus.JOINED,
  }));
}