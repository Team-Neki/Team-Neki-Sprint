import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import type { JSONContent } from "@tiptap/react";
import { getWikiPage } from "@/server/queries";
import { deleteWikiPage } from "@/server/actions/wiki";
import { WikiEditor } from "@/components/wiki/editor";
import { UserBadge } from "@/components/user-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";

export const dynamic = "force-dynamic";

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function asDoc(content: unknown): JSONContent {
  if (
    content &&
    typeof content === "object" &&
    "type" in content &&
    (content as { type?: string }).type === "doc"
  ) {
    return content as JSONContent;
  }
  return EMPTY_DOC;
}

export default async function WikiPageView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const page = await getWikiPage(id);
  if (!page) notFound();

  async function handleDelete() {
    "use server";
    await deleteWikiPage(id);
  }

  return (
    <div>
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          {page.editor && <UserBadge user={page.editor} size="xs" />}
          <span>
            {formatDistanceToNow(page.updatedAt, {
              addSuffix: true,
              locale: ko,
            })}{" "}
            수정
          </span>
        </div>
        <ConfirmDelete
          onConfirm={handleDelete}
          redirectTo="/wiki"
          title="이 페이지를 삭제할까요?"
          description="하위 페이지가 있다면 함께 삭제됩니다."
          trigger={
            <Button variant="ghost" size="sm" className="text-destructive">
              <Trash2 className="size-4" /> 삭제
            </Button>
          }
        />
      </div>

      <WikiEditor
        key={page.id}
        pageId={page.id}
        initialTitle={page.title}
        initialContent={asDoc(page.content)}
      />
    </div>
  );
}
