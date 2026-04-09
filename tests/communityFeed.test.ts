import assert from "node:assert/strict";

import { runCase } from "./testHarness";
import {
  mergeCommunityPostsForPagination,
  mergeCommunityPostsForRefresh,
} from "@/lib/communityFeed";

/** 社区列表去重与详情态保留测试。 */
export async function runCommunityFeedTests() {
  console.log("[Suite] communityFeed");

  await runCase("keeps detail commentList when pagination returns the same post again", () => {
    const merged = mergeCommunityPostsForPagination(
      [
        {
          id: "post-1",
          title: "第一条",
          comments: 2,
          commentList: [{ id: "comment-1" }],
        },
      ],
      [
        {
          id: "post-1",
          title: "第一条-刷新",
          comments: 3,
        },
        {
          id: "post-2",
          title: "第二条",
          comments: 0,
        },
      ],
    );

    assert.deepEqual(merged, [
      {
        id: "post-1",
        title: "第一条-刷新",
        comments: 3,
        commentList: [{ id: "comment-1" }],
      },
      {
        id: "post-2",
        title: "第二条",
        comments: 0,
      },
    ]);
  });

  await runCase("keeps server refresh order while preserving known detail fields", () => {
    const refreshed = mergeCommunityPostsForRefresh(
      [
        {
          id: "post-2",
          title: "旧第二条",
          commentList: [{ id: "comment-2" }],
        },
        {
          id: "post-1",
          title: "旧第一条",
        },
      ],
      [
        {
          id: "post-1",
          title: "新第一条",
        },
        {
          id: "post-2",
          title: "新第二条",
        },
      ],
    );

    assert.deepEqual(refreshed, [
      {
        id: "post-1",
        title: "新第一条",
      },
      {
        id: "post-2",
        title: "新第二条",
        commentList: [{ id: "comment-2" }],
      },
    ]);
  });
}
