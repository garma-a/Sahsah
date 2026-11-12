"use client";

import { useCallback, useState } from "react";
import { toneAt } from "@/components/brand/tones";
import type { QuestionAction } from "@/components/game/host-bar";
import QuestionScreen from "@/components/game/question-screen";
import Board from "@/components/room/board";
import { ResultHolding } from "@/components/room/holding-panel";
import Scoreboard from "@/components/room/scoreboard";
import ErrorBanner from "@/components/ui/error-banner";
import type { Auth } from "@/lib/api/client";
import { executeCommand } from "@/lib/api/endpoints";
import { isConflict, messageOf } from "@/lib/api/errors";
import type { BoardView, Category, GameCommand, QuestionView, TeamNumber } from "@/lib/api/types";
import type { RoomChannel } from "@/lib/realtime/use-room-channel";
import { loadRoster } from "@/lib/roster";
import { useIntentKeys } from "@/lib/use-intent-keys";

type CategoryIndex = ReadonlyMap<string, { category: Category; index: number }>;

type GameScreenProps = {
  channel: RoomChannel;
  roomId: string;
  auth: Auth;
  isHost: boolean;
  categories: CategoryIndex;
};

/** What the live game shows: the board, the open question or its answer, or the result. */
export default function GameScreen({ channel, roomId, auth, isHost, categories }: GameScreenProps) {
  const { snapshot } = channel;
  const intents = useIntentKeys();
  const [pending, setPending] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // The last board survives while a question is open: the question view names no category, the board does.
  const [lastBoard, setLastBoard] = useState<BoardView | null>(null);
  // Only for an API whose game views carry no team players: the roster this browser saw in the lobby.
  const [roster] = useState(() => loadRoster(roomId));
  const view = snapshot?.view;
  if (view?.phase === "board" && view !== lastBoard) setLastBoard(view);

  const gameId = snapshot && "gameId" in snapshot.source ? snapshot.source.gameId : null;
  const gameVersion = snapshot && "gameVersion" in snapshot.source ? snapshot.source.gameVersion : null;

  const run = useCallback(
    async (pendingKey: string, command: GameCommand) => {
      if (!gameId) return;
      setPending(pendingKey);
      setProblem(null);
      // The command names its game version, so the same click against the same state keeps the same key.
      const signature = JSON.stringify(command);
      try {
        await executeCommand(gameId, auth, intents.key(signature), command);
        intents.done(signature);
        channel.refresh();
      } catch (cause) {
        setProblem(messageOf(cause));
        if (isConflict(cause)) channel.refresh();
      } finally {
        setPending(null);
      }
    },
    [gameId, auth, channel, intents],
  );

  if (!snapshot || !view || !gameVersion || !gameId) return null;

  if (view.phase === "result") return <ResultHolding view={view} />;

  const scoreboard = (teams: BoardView["teams"]) => <Scoreboard teams={teams} members={roster} connected={channel.connected} />;

  if (view.phase === "board") {
    return (
      <div className="flex flex-1 flex-col">
        {problem && <ErrorBanner className="mb-3">{problem}</ErrorBanner>}
        <Board
          view={view}
          categories={categories}
          canOpen={isHost && view.audience === "host"}
          pending={pending}
          onOpen={(boardPosition, questionPosition) =>
            run(`${boardPosition}:${questionPosition}`, { name: "open_question", expectedGameVersion: gameVersion, boardPosition, questionPosition })
          }
        />
        {scoreboard(view.teams)}
      </div>
    );
  }

  const question = view as QuestionView;
  const pointer = { expectedGameVersion: gameVersion, boardPosition: question.boardPosition, questionPosition: question.questionPosition };
  const column = lastBoard?.board.find((c) => c.boardPosition === question.boardPosition);
  const toneIndex = (column && categories.get(column.categoryId)?.index) ?? question.boardPosition;

  return (
    <div className="flex flex-1 flex-col">
      <QuestionScreen
        view={question}
        categoryName={column?.name}
        tone={toneAt(toneIndex)}
        isHost={isHost}
        gameId={gameId}
        auth={auth}
        clockOffsetMs={channel.clockOffsetMs}
        pending={pending}
        problem={problem}
        onAct={(name: QuestionAction) => run(name, { name, ...pointer })}
        onResolve={(winner: TeamNumber | null, points) =>
          run("resolve_question", { name: "resolve_question", ...pointer, winningTeamNumber: winner, ...(points === undefined ? {} : { awardedPoints: points }) })
        }
      />
      {scoreboard(question.teams)}
    </div>
  );
}
