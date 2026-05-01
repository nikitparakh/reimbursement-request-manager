"use client";

import { useMemo, useState } from "react";
import type { ProgramCode } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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
          id="districtId"
          value={districtId}
          onChange={(event) => {
            setDistrictId(event.target.value);
            setSelectedSchoolId("");
            setSelectedProgramId("");
            setSelectedTeamId("");
          }}
        >
          {districts.map((district) => (
            <option key={district.id} value={district.id}>
              {district.name}
            </option>
          ))}
        </Select>
      </FieldGroup>

      <FieldGroup label="School" htmlFor="schoolId">
        <Select
          id="schoolId"
          value={schoolId}
          onChange={(event) => {
            setSelectedSchoolId(event.target.value);
            setSelectedProgramId("");
            setSelectedTeamId("");
          }}
        >
          {schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name}
            </option>
          ))}
        </Select>
      </FieldGroup>

      <FieldGroup label="Program" htmlFor="programId">
        <Select
          id="programId"
          value={programId}
          onChange={(event) => {
            setSelectedProgramId(event.target.value);
            setSelectedTeamId("");
          }}
        >
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </Select>
      </FieldGroup>

      <FieldGroup label="Team" htmlFor="teamId">
        <Select id="teamId" value={teamId} onChange={(event) => setSelectedTeamId(event.target.value)}>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
      </FieldGroup>

      <FieldGroup label="Role" htmlFor="roleIntent">
        <Select
          id="roleIntent"
          value={roleIntent}
          onChange={(event) => setRoleIntent(event.target.value as "PARENT_MENTOR" | "COACH")}
        >
          <option value="PARENT_MENTOR">Parent/Mentor</option>
          <option value="COACH">Coach</option>
        </Select>
      </FieldGroup>

      <Button onClick={submit} disabled={!teamId}>Save</Button>

      {message ? <Alert variant={isSuccess ? "success" : "error"}>{message}</Alert> : null}
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
