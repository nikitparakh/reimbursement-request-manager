"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ProgramCode } from "@/db/schema";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const teamSelectorFormSchema = z.object({
  districtId: z.string().min(1, "Choose a district"),
  schoolId: z.string().min(1, "Choose a school"),
  programId: z.string().min(1, "Choose a program"),
  teamId: z.string().min(1, "Choose a team"),
  roleIntent: z.enum(["PARENT_MENTOR", "COACH"]),
});

type TeamSelectorFormValues = z.infer<typeof teamSelectorFormSchema>;

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

function defaultsFromDistricts(districts: DistrictOption[]): TeamSelectorFormValues {
  const districtId = districts[0]?.id ?? "";
  const schools = districts.find((d) => d.id === districtId)?.schools ?? [];
  const schoolId = schools[0]?.id ?? "";
  const programs = schools.find((s) => s.id === schoolId)?.programs ?? [];
  const programId = programs[0]?.id ?? "";
  const teams = programs.find((p) => p.id === programId)?.teams ?? [];
  const teamId = teams[0]?.id ?? "";
  return {
    districtId,
    schoolId,
    programId,
    teamId,
    roleIntent: "PARENT_MENTOR",
  };
}

export function TeamSelector({ districts }: { districts: DistrictOption[] }) {
  const router = useRouter();
  const initial = useMemo(() => defaultsFromDistricts(districts), [districts]);

  const form = useForm<TeamSelectorFormValues>({
    resolver: zodResolver(teamSelectorFormSchema),
    defaultValues: initial,
  });

  const districtId = useWatch({
    control: form.control,
    name: "districtId",
    defaultValue: initial.districtId,
  });
  const schools = useMemo(
    () => districts.find((district) => district.id === districtId)?.schools ?? [],
    [districtId, districts]
  );

  const schoolId = useWatch({
    control: form.control,
    name: "schoolId",
    defaultValue: initial.schoolId,
  });
  const programs = useMemo(
    () => schools.find((school) => school.id === schoolId)?.programs ?? [],
    [schoolId, schools]
  );

  const programId = useWatch({
    control: form.control,
    name: "programId",
    defaultValue: initial.programId,
  });
  const teams = useMemo(
    () => programs.find((program) => program.id === programId)?.teams ?? [],
    [programId, programs]
  );

  const teamIdValue = useWatch({
    control: form.control,
    name: "teamId",
    defaultValue: initial.teamId,
  });

  async function onSubmit(data: TeamSelectorFormValues) {
    const response = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        districtId: data.districtId,
        schoolId: data.schoolId,
        programId: data.programId,
        teamId: data.teamId,
        roleIntent: data.roleIntent,
      }),
    });

    if (!response.ok) {
      const errorMessage = await readErrorMessage(response);
      toast.error(errorMessage);
      if (response.status === 401) {
        router.replace("/sign-in");
      }
      return;
    }

    toast.success("Onboarding complete. Your team workspace is ready.");
    // Move the user off /onboarding into their workspace. router.refresh()
    // re-renders the server NavBar/layout so the now-populated access flags
    // (team membership just created) repopulate the nav instead of leaving the
    // user stranded on an empty-nav onboarding page.
    const destination =
      data.roleIntent === "COACH" ? "/coach/team-overview" : "/team";
    router.replace(destination);
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="districtId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>District</FormLabel>
              <Select
                value={field.value || undefined}
                onValueChange={(value) => {
                  field.onChange(value);
                  const nextSchools =
                    districts.find((district) => district.id === value)?.schools ?? [];
                  const nextSchoolId = nextSchools[0]?.id ?? "";
                  form.setValue("schoolId", nextSchoolId);
                  const nextPrograms =
                    nextSchools.find((s) => s.id === nextSchoolId)?.programs ?? [];
                  const nextProgramId = nextPrograms[0]?.id ?? "";
                  form.setValue("programId", nextProgramId);
                  const nextTeams =
                    nextPrograms.find((p) => p.id === nextProgramId)?.teams ?? [];
                  form.setValue("teamId", nextTeams[0]?.id ?? "");
                }}
                disabled={districts.length === 0}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose district" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {districts.map((district) => (
                    <SelectItem key={district.id} value={district.id}>
                      {district.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="schoolId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>School</FormLabel>
              <Select
                value={field.value || undefined}
                onValueChange={(value) => {
                  field.onChange(value);
                  const nextPrograms = schools.find((school) => school.id === value)?.programs ?? [];
                  const nextProgramId = nextPrograms[0]?.id ?? "";
                  form.setValue("programId", nextProgramId);
                  const nextTeams =
                    nextPrograms.find((p) => p.id === nextProgramId)?.teams ?? [];
                  form.setValue("teamId", nextTeams[0]?.id ?? "");
                }}
                disabled={schools.length === 0}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose school" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="programId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Program</FormLabel>
              <Select
                value={field.value || undefined}
                onValueChange={(value) => {
                  field.onChange(value);
                  const nextTeams =
                    programs.find((program) => program.id === value)?.teams ?? [];
                  form.setValue("teamId", nextTeams[0]?.id ?? "");
                }}
                disabled={programs.length === 0}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose program" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="teamId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team</FormLabel>
              <Select
                value={field.value || undefined}
                onValueChange={field.onChange}
                disabled={teams.length === 0}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose team" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="roleIntent"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="PARENT_MENTOR">Parent/Mentor</SelectItem>
                  <SelectItem value="COACH">Coach</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={!teamIdValue} loading={form.formState.isSubmitting}>
          Save
        </Button>
      </form>
    </Form>
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
