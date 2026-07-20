"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ render, ...props }: DialogPrimitive.Trigger.Props) {
  // render 로 커스텀 요소(<Button/> 등, 자체 data-slot 보유)를 넣을 땐 data-slot 키
  // 자체를 넘기지 않는다(값 undefined 도 안 됨 — 키가 있으면 병합에서 override 됨).
  // Base UI 의 render 병합은 SSR 에선 트리거(outer)의 data-slot 이, CSR 에선 렌더
  // 요소(inner)의 data-slot 이 이겨서 둘 다 값을 주면 hydration 불일치가 난다
  // (server="dialog-trigger"/null vs client="button"). 트리거가 키를 안 주면 양쪽 모두
  // 렌더 요소의 slot 으로 수렴한다. standalone(render 없음)일 때만 slot 을 부여.
  return (
    <DialogPrimitive.Trigger
      {...(render ? {} : { "data-slot": "dialog-trigger" })}
      render={render}
      {...props}
    />
  )
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ render, ...props }: DialogPrimitive.Close.Props) {
  // DialogTrigger 와 동일: render 로 <Button/> 등을 넣을 땐 data-slot 키를 생략해
  // 렌더 요소의 slot 에 양보한다(hydration 불일치 방지).
  return (
    <DialogPrimitive.Close
      {...(render ? {} : { "data-slot": "dialog-close" })}
      render={render}
      {...props}
    />
  )
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        // z-[65]: 상세 사이드 시트(SheetContent z-[60]) 위에 떠야 시트 안에서 연
        // 삭제 확인 등 다이얼로그가 시트에 가려지지 않는다. 팝업 positioner(z-[70])
        // 보다는 낮게 둬 다이얼로그 안의 select/dropdown 이 다이얼로그 위에 뜬다. [gotchas §21]
        "fixed inset-0 isolate z-[65] bg-black/10 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        className={cn(
          // max-h + overflow-y-auto: 폼이 긴 다이얼로그(태스크/에픽/스프린트 등)가 모바일
          // 뷰포트보다 길면, fixed + -translate-y-1/2 특성상 상하가 화면 밖으로 잘려나가고
          // 페이지 스크롤로도 닿을 수 없었다(제목·저장 버튼 접근 불가). 팝업 자체를
          // 스크롤 컨테이너로 만들어 해결. 100dvh 는 모바일 브라우저 주소창 높이 변화 대응.
          "fixed top-1/2 left-1/2 z-[65] grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto overscroll-contain rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon
            />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        // sticky -bottom-4: DialogContent 가 스크롤 컨테이너이므로, 긴 폼에서도 저장/취소가
        // 항상 보이게 바닥에 고정한다. offset 이 0 이 아니라 -4(=-1rem)인 건 브라우저가
        // sticky 제약 사각형을 스크롤 컨테이너의 padding(p-4)만큼 이미 inset 하기 때문 —
        // bottom-0 이면 팝업 하단에서 16px 떠서 rounded-b-xl 모서리가 어긋난다(실측 확인).
        // 배경은 muted/50(반투명) 대신 불투명 muted(=인셋 면 #f5f5f5) — 고정된 동안 아래로
        // 지나가는 본문이 비쳐 보이면 안 된다.
        "sticky -bottom-4 z-10 -mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted p-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
