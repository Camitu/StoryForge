# @storyforge/shared

StoryForge 共享数据模型：**beat 结构化剧本 + 人物/场景/伏笔 + 叙事状态压缩** 的 TypeScript 类型定义。

编辑器（`editor/`）、运行时（`runtime/`）、项目服务（`server/`）共用这套类型，保证数据契约一致。

## 目录

```
src/
├── index.ts            # 统一出口
└── types/
    ├── ids.ts          # EntityId / StoryTime 等基础标量
    ├── beat.ts         # Beat 判别联合 + Anchor（核心：结构化剧本单元）
    ├── character.ts    # Character / ExpressionDef / CharacterState
    ├── scene.ts        # Scene / SceneLayer（多层视差）
    ├── foreshadow.ts   # Foreshadow（伏笔-回收）
    ├── state.ts        # WorldState / StateDelta（叙事状态压缩）
    ├── asset.ts        # Asset（资产库）
    └── project.ts      # Project / Chapter / Section
examples/
└── sample-project.json # 一个 2 角色的小示例工程
```

## 核心概念

1. **Beat 是权威存储**：Galgame 脚本以结构化 beat 存储，Markdown 只是「视图」。
2. **叙事状态压缩**：`WorldState`（快照）+ `StateDelta`（浓缩差量）是 AI 协作的上下文契约 —— AI 写任意小节只需「快照 + 附近锚点」，不必读全文。

> 完整方案见仓库根 `docs/PLAN.md`。
