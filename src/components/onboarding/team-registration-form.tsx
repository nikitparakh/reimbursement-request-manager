"use client";

import { useMemo, useState } from "react";
import type { ProgramCode } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Alert } from "@/components/ui/alert";
import { Select } from "@/components/ui/select";

type ProgramOption = {
  id: string;
  code: ProgramCode;
  name: string;
};

type SchoolOption = {
  id: string;
  name: string;
};

type DistrictOption = {
  id: string;
  name: string;
  schools: SchoolOption[];
};

export function TeamRegistrationForm({ districts, programs }: { districts: DistrictOption[]; programs: ProgramOption[] }) {
  const [districtId, setDistrictId] = useState(districts[0]?.id ?? "");
  const schools = useMemo(
    () => districts.find((district) => district.id === districtId)?.schools ?? [],
    [districtId, districts]
  );
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const schoolId = schools.some((school) => school.id === selectedSchoolId)
    ? selectedSchoolId
    : (schools[0]?.id ?? "");
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const selectedProgram = programs.find((program) => program.id === programId);
  const [fllDivision, setFllDivision] = useState<"DISCOVER" | "EXPLORE" | "CHALLENGE">("CHALLENGE");
  const [teamName, setTeamName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [glAccount, setGlAccount] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  async function submit() {
    setMessage("");
    const response = await fetch("/api/teams/registration-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        districtId,
        schoolId,
        programId,
        teamName,
        shortCode: shortCode || undefined,
        glAccount: glAccount || undefined,
        fllDivision: selectedProgram?.code === "FLL" ? fllDivision : undefined,
        notes,
      }),
    });

    if (!response.ok) {
      setMessage("Unable to send team registration request.");
      setIsSuccess(false);
      return;
    }

    setIsSuccess(true);
    setMessage("Team request sent for school admin review.");
    setTeamName("");
    setShortCode("");
    setGlAccount("");
    setNotes("");
  }

  return (
    <div className="space-y-4">
      <FormField label="District" htmlFor="requestDistrictId">
        <Select
          id="requestDistrictId"
          value={districtId}
          onChange={(event) => {
            setDistrictId(event.target.value);
            setSelectedSchoolId("");
          }}
        >
          {districts.map((district) => (
            <option key={district.id} value={district.id}>
              {district.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="School" htmlFor="requestSchoolId">
        <Select id="requestSchoolId" value={schoolId} onChange={(event) => setSelectedSchoolId(event.target.value)}>
          {schools.map((school) => (
            <option key={school.id} value={school.id}>
              {school.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Program" htmlFor="requestProgramId">
        <Select id="requestProgramId" value={programId} onChange={(event) => setProgramId(event.target.value)}>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </Select>
      </FormField>

      {selectedProgram?.code === "FLL" ? (
        <FormField label="FLL Division" htmlFor="fllDivision" helpText="Optional for LEGO League team setup">
          <Select id="fllDivision" value={fllDivision} onChange={(event) => setFllDivision(event.target.value as typeof fllDivision)}>
            <option value="DISCOVER">Discover</option>
            <option value="EXPLORE">Explore</option>
            <option value="CHALLENGE">Challenge</option>
          </Select>
        </FormField>
      ) : null}

      <FormField label="Team Name" htmlFor="teamName">
        <Input
          id="teamName"
          value={teamName}
          onChange={(event) => setTeamName(event.target.value)}
          placeholder="e.g. Robotics Team Alpha"
        />
      </FormField>

      <FormField label="Short Code" htmlFor="shortCode" helpText="Optional team abbreviation">
        <Input
          id="shortCode"
          value={shortCode}
          onChange={(event) => setShortCode(event.target.value)}
          placeholder="e.g. RTA"
        />
      </FormField>

      <FormField label="GL Account" htmlFor="glAccount" helpText="Optional GL account number">
        <Input
          id="glAccount"
          value={glAccount}
          onChange={(event) => setGlAccount(event.target.value)}
          placeholder="e.g. 61-296-7920-099-978-0000"
        />
      </FormField>

      <FormField label="Notes" htmlFor="notes">
        <Textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Any additional details about the team..."
          rows={3}
        />
      </FormField>

      <Button variant="secondary" onClick={submit}>Submit Request</Button>

      {message ? <Alert variant={isSuccess ? "success" : "error"}>{message}</Alert> : null}
    </div>
  );
}
