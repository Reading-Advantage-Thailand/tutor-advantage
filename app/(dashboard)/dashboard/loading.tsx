import { Header } from "@/components/header"
import { PostCreateButton } from "@/components/post-create-button"
import { PostItem } from "@/components/post-item"
import { Shell } from "@/components/shell"

export default function DashboardLoading() {
  return (
    <Shell>
      <Header heading="Posts" text="Create and manage posts.">
        <PostCreateButton />
      </Header>
      <div className="divide-border-200 divide-y rounded-md border">
        <PostItem.Skeleton />
        <PostItem.Skeleton />
        <PostItem.Skeleton />
        <PostItem.Skeleton />
        <PostItem.Skeleton />
      </div>
    </Shell>
  )
}
