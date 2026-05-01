"use client";

import { useMemo, useState } from "react";
import type { ProgramCode } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldGroup } from "@/components/ui/field-group";
import { Alert } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      <FieldGroup label="District" htmlFor="requestDistrictId">
        <Select
          value={districtId || undefined}
          onValueChange={(value) => {
            setDistrictId(value);
            setSelectedSchoolId("");
          }}
          disabled={districts.length === 0}
        >
          <SelectTrigger id="requestDistrictId" className="w-full">
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

      <FieldGroup label="School" htmlFor="requestSchoolId">
        <Select
          value={schoolId || undefined}
          onValueChange={setSelectedSchoolId}
          disabled={schools.length === 0}
        >
          <SelectTrigger id="requestSchoolId" className="w-full">
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

      <FieldGroup label="Program" htmlFor="requestProgramId">
        <Select
          value={programId || undefined}
          onValueChange={setProgramId}
          disabled={programs.length === 0}
        >
          <SelectTrigger id="requestProgramId" className="w-full">
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

      {selectedProgram?.code === "FLL" ? (
        <FieldGroup label="FLL Division" htmlFor="fllDivision" hint="Optional for LEGO League team setup">
          <Select
            value={fllDivision}
            onValueChange={(value) =>
              setFllDivision(value as "DISCOVER" | "EXPLORE" | "CHALLENGE")
            }
          >
            <SelectTrigger id="fllDivision" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DISCOVER">Discover</SelectItem>
              <SelectItem value="EXPLORE">Explore</SelectItem>
              <SelectItem value="CHALLENGE">Challenge</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
      ) : null}

      <FieldGroup label="Team Name" htmlFor="teamName">
        <Input
          id="teamName"
          value={teamName}
          onChange={(event) => setTeamName(event.target.value)}
          placeholder="e.g. Robotics Team Alpha"
        />
      </FieldGroup>

      <FieldGroup label="Short Code" htmlFor="shortCode" hint="Optional team abbreviation">
        <Input
          id="shortCode"
          value={shortCode}
          onChange={(event) => setShortCode(event.target.value)}
          placeholder="e.g. RTA"
        />
      </FieldGroup>

      <FieldGroup label="GL Account" htmlFor="glAccount" hint="Optional GL account number">
        <Input
          id="glAccount"
          value={glAccount}
          onChange={(event) => setGlAccount(event.target.value)}
          placeholder="e.g. 61-296-7920-099-978-0000"
        />
      </FieldGroup>

      <FieldGroup label="Notes" htmlFor="notes">
        <Textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Any additional details about the team..."
          rows={3}
        />
      </FieldGroup>

      <Button variant="secondary" onClick={submit}>Submit Request</Button>

      {message ? <Alert variant={isSuccess ? "success" : "destructive"}>{message}</Alert> : null}
    </div>
  );
}
