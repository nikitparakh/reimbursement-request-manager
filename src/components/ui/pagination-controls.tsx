import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

type PaginationControlsProps = {
  basePath: string
  prevCursor: string | null
  nextCursor: string | null
}

export function PaginationControls({
  basePath,
  prevCursor,
  nextCursor,
}: PaginationControlsProps) {
  if (!prevCursor && !nextCursor) return null

  return (
    <Pagination className="mx-0 w-full justify-between pt-4">
      <PaginationContent className="w-full justify-between">
        <PaginationItem>
          {prevCursor ? (
            <Button variant="ghost" size="default" asChild className="pl-2">
              <Link
                href={`${basePath}?cursor=${prevCursor}&dir=prev`}
                aria-label="Go to previous page"
              >
                <ChevronLeftIcon data-icon="inline-start" />
                <span className="hidden sm:inline">Previous</span>
              </Link>
            </Button>
          ) : (
            <span className="inline-flex h-8 min-w-24" aria-hidden />
          )}
        </PaginationItem>
        <PaginationItem>
          {nextCursor ? (
            <Button variant="ghost" size="default" asChild className={cn("pr-2")}>
              <Link
                href={`${basePath}?cursor=${nextCursor}`}
                aria-label="Go to next page"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          ) : (
            <span className="inline-flex h-8 min-w-24" aria-hidden />
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
