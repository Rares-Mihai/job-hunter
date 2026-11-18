import type { Metadata } from "next";
import Link from "next/link";
import { AnalysisResult, MatchResult } from "@/components/AiPanel";
import { Board, type BoardCard } from "@/components/Board";
import { WeekGoal } from "@/components/WeekGoal";
import type { CvMatch, JobAnalysis } from "@/lib/ai/schemas";

export const metadata: Metadata = { title: "Demo" };

// A look at the app without signing in. Everything on this page is invented
// sample data that lives only in the visitor's browser: nothing is read from
// or written to the database, and no AI request is made.

const CARDS: BoardCard[] = [
  {
    id: "1",
    company: "Northwind Labs",
    role: "Backend Intern",
    location: "Iași",
    status: "wishlist",
    deadline: { label: "Due in 3 days", tone: "soon" },
    matchScore: null,
  },
  {
    id: "2",
    company: "Blue Harbor",
    role: "Junior Web Developer",
    location: "Remote",
    status: "wishlist",
    deadline: { label: "Due 6 Dec", tone: "later" },
    matchScore: 64,
  },
  {
    id: "3",
    company: "Cedar Systems",
    role: "Software Engineer Intern",
    location: "București",
    status: "applied",
    deadline: null,
    matchScore: 72,
  },
  {
    id: "4",
    company: "Lumen Data",
    role: "Data Engineering Intern",
    location: "Cluj-Napoca",
    status: "applied",
    deadline: null,
    matchScore: null,
  },
  {
    id: "5",
    company: "Pinecrest",
    role: "QA Automation Intern",
    location: "Iași",
    status: "interview",
    deadline: null,
    matchScore: 81,
  },
  {
    id: "6",
    company: "Atlas Robotics",
    role: "Embedded Software Intern",
    location: "Timișoara",
    status: "offer",
    deadline: null,
    matchScore: null,
  },
  {
    id: "7",
    company: "Greyfield",
    role: "Graduate Developer",
    location: "București",
    status: "rejected",
    deadline: null,
    matchScore: null,
  },
];

const ANALYSIS: JobAnalysis = {
  summary:
    "An internship on a small backend team that builds internal tools. It suits a student with solid programming basics who wants to work on a real product.",
  seniority: "internship",
  requirements: [
    { skill: "Python or Java", importance: "must" },
    { skill: "SQL", importance: "must" },
    { skill: "Git", importance: "must" },
    { skill: "Docker", importance: "nice" },
    { skill: "REST APIs", importance: "nice" },
  ],
  responsibilities: [
    "Build and test features with a mentor",
    "Write automated tests",
    "Take part in code reviews",
  ],
};

const MATCH: CvMatch = {
  score: 72,
  verdict:
    "You cover the required skills, but the CV shows nothing about containers or APIs.",
  matchedSkills: ["Python", "SQL", "Git"],
  missingSkills: ["Docker", "REST APIs"],
  highlights: [
    "Lead with the university database project, since it uses Python and SQL together.",
  ],
  suggestions: [
    "Add a small project that exposes a REST API and runs in Docker.",
  ],
};

export default function DemoPage() {
  return (
    <div>
      <p className="mb-8 max-w-[70ch] rounded-md border border-line bg-surface px-4 py-3">
        This is a demo with invented companies. Drag the cards around; nothing
        is saved.{" "}
        <Link href="/sign-in" className="link">
          Sign in
        </Link>{" "}
        to keep your own board.
      </p>
      <h1 className="sr-only">Demo board</h1>
      <WeekGoal sent={3} target={5} streakWeeks={4} />
      <Board cards={CARDS} demo />

      <div className="mt-14 grid max-w-5xl gap-x-14 gap-y-10 lg:grid-cols-2">
        <section aria-labelledby="demo-analysis">
          <h2 id="demo-analysis" className="text-2xl font-bold">
            What the AI reads in a posting
          </h2>
          <AnalysisResult analysis={ANALYSIS} draw={false} />
        </section>
        <section aria-labelledby="demo-match">
          <h2 id="demo-match" className="text-2xl font-bold">
            How your CV compares
          </h2>
          <MatchResult match={MATCH} draw={false} />
        </section>
      </div>
    </div>
  );
}
