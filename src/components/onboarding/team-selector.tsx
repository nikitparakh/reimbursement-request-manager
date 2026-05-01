"use client";

import { useMemo, useState } from "react";
import type { ProgramCode } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldGroup } from "@/components/ui/field-group";
import { Alert } from "@/components/ui/alert";

type TeamOption = {
  id: string;
  name: string;
  shortCode: string | null;
};

type ProgramOption = {
  id: string;
  code: ProgramCode;
  name: string;
  teams: TeamOption[];
};

type SchoolOption = {
  id: string;
  name: string;
  programs: ProgramOption[];
};

type DistrictOption = {
  id: string;
  name: string;
  schools: SchoolOption[];
};

export function TeamSelector({ districts }: { districts: DistrictOption[] }) {
  const [districtId, setDistrictId] = useState(districts[0]?.id ?? "");
  const schools = useMemo(
    () => districts.find((district) => district.id === districtId)?.schools ?? [],
    [districtId, districts]
  );
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const schoolId = schools.some((school) => school.id === selectedSchoolId)
    ? selectedSchoolId
    : (schools[0]?.id ?? "");
  const programs = useMemo(
    () => schools.find((school) => school.id === schoolId)?.programs ?? [],
    [schoolId, schools]
  );
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const programId = programs.some((program) => program.id === selectedProgramId)
    ? selectedProgramId
    : (programs[0]?.id ?? "");
  const teams = useMemo(
    () => programs.find((program) => program.id === programId)?.teams ?? [],
    [programId, programs]
  );
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const teamId = teams.some((team) => team.id === selectedTeamId) ? selectedTeamId : (teams[0]?.id ?? "");
  const [roleIntent, setRoleIntent] = useState<"PARENT_MENTOR" | "COACH">("PARENT_MENTOR");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  async function submit() {
    setMessage("");
    const response = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ districtId, schoolId, programId, teamId, roleIntent }),
    });
    if (!response.ok) {
      const errorMessage = await readErrorMessage(response);
      setMessage(errorMessage);
      setIsSuccess(false);
      if (response.status === 401) {
        window.location.href = "/sign-in";
      }
      return;
    }
    setIsSuccess(true);
    setMessage("Onboarding complete. Your team workspace is ready.");
  }

  return (
    <div className="space-y-4">
      <FieldGroup label="District" htmlFor="districtId">
        <Select
          value={districtId || undefined}
          onValueChange={(value) => {
            setDistrictId(value);
            setSelectedSchoolId("");
            setSelectedProgramId("");
            setSelectedTeamId("");
          }}
          disabled={districts.length === 0}
        >
          <SelectTrigger id="districtId" className="w-full">
            <SelectValue placeholder="Choose district" />
          </SelectTrigger>
          <SelectContent>
            {districts.map((district) => (
              <SelectItem key={district.id} value={district.id}>
                {district.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldGroup>

      <FieldGroup label="School" htmlFor="schoolId">
        <Select
          value={schoolId || undefined}
          onValueChange={(value) => {
            setSelectedSchoolId(value);
            setSelectedProgramId("");
            setSelectedTeamId("");
          }}
          disabled={schools.length === 0}
        >
          <SelectTrigger id="schoolId" className="w-full">
            <SelectValue placeholder="Choose school" />
          </SelectTrigger>
          <SelectContent>
            {schools.map((school) => (
              <SelectItem key={school.id} value={school.id}>
                {school.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldGroup>

      <FieldGroup label="Program" htmlFor="programId">
        <Select
          value={programId || undefined}
          onValueChange={(value) => {
            setSelectedProgramId(value);
            setSelectedTeamId("");
          }}
          disabled={programs.length === 0}
        >
          <SelectTrigger id="programId" className="w-full">
            <SelectValue placeholder="Choose program" />
          </SelectTrigger>
          <SelectContent>
            {programs.map((program) => (
              <SelectItem key={program.id} value={program.id}>
                {program.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldGroup>

      <FieldGroup label="Team" htmlFor="teamId">
        <Select
          value={teamId || undefined}
          onValueChange={setSelectedTeamId}
          disabled={teams.length === 0}
        >
          <SelectTrigger id="teamId" className="w-full">
            <SelectValue placeholder="Choose team" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>
                {team.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldGroup>

      <FieldGroup label="Role" htmlFor="roleIntent">
        <Select
          value={roleIntent}
          onValueChange={(value) =>
            setRoleIntent(value as "PARENT_MENTOR" | "COACH")
          }
        >
          <SelectTrigger id="roleIntent" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PARENT_MENTOR">Parent/Mentor</SelectItem>
            <SelectItem value="COACH">Coach</SelectItem>
          </SelectContent>
        </Select>
      </FieldGroup>

      <Button onClick={submit} disabled={!teamId}>Save</Button>

      {message ? <Alert variant={isSuccess ? "success" : "destructive"}>{message}</Alert> : null}
    </div>
  );
}

async function readErrorMessage(response: Response) {
  const fallback = "Unable to complete onboarding.";
  const body = await response.text();
  if (!body) return fallback;
  try {
    const payload = JSON.parse(body) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}
