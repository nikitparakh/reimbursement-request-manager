"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ProgramCode } from "@prisma/client";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const teamRegistrationFormSchema = z.object({
  districtId: z.string().min(1, "Choose a district"),
  schoolId: z.string().min(1, "Choose a school"),
  programId: z.string().min(1, "Choose a program"),
  teamName: z.string().min(2, "Team name must be at least 2 characters"),
  shortCode: z.string().max(12).optional().or(z.literal("")),
  glAccount: z.string().max(30).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
  fllDivision: z.enum(["DISCOVER", "EXPLORE", "CHALLENGE"]),
});

type TeamRegistrationFormValues = z.infer<typeof teamRegistrationFormSchema>;

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

function defaultsFor(
  districts: DistrictOption[],
  programs: ProgramOption[]
): Pick<
  TeamRegistrationFormValues,
  "districtId" | "schoolId" | "programId" | "fllDivision"
> {
  const districtId = districts[0]?.id ?? "";
  const schools = districts.find((d) => d.id === districtId)?.schools ?? [];
  const schoolId = schools[0]?.id ?? "";
  const programId = programs[0]?.id ?? "";
  return { districtId, schoolId, programId, fllDivision: "CHALLENGE" };
}

export function TeamRegistrationForm({
  districts,
  programs,
}: {
  districts: DistrictOption[];
  programs: ProgramOption[];
}) {
  const initial = useMemo(() => defaultsFor(districts, programs), [districts, programs]);

  const form = useForm<TeamRegistrationFormValues>({
    resolver: zodResolver(teamRegistrationFormSchema),
    defaultValues: {
      ...initial,
      teamName: "",
      shortCode: "",
      glAccount: "",
      notes: "",
    },
  });

  const districtId = useWatch({ control: form.control, name: "districtId", defaultValue: initial.districtId });
  const schools = useMemo(
    () => districts.find((d) => d.id === districtId)?.schools ?? [],
    [districtId, districts]
  );
  const programId = useWatch({ control: form.control, name: "programId", defaultValue: initial.programId });
  const selectedProgram = programs.find((p) => p.id === programId);

  async function onSubmit(data: TeamRegistrationFormValues) {
    const payload = {
      districtId: data.districtId,
      schoolId: data.schoolId,
      programId: data.programId,
      teamName: data.teamName.trim(),
      shortCode: data.shortCode?.trim() || undefined,
      glAccount: data.glAccount?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      fllDivision: selectedProgram?.code === "FLL" ? data.fllDivision : undefined,
    };

    const response = await fetch("/api/teams/registration-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      toast.error("Unable to send team registration request.");
      return;
    }

    toast.success("Team request sent for school admin review.");
    form.reset({
      ...defaultsFor(districts, programs),
      teamName: "",
      shortCode: "",
      glAccount: "",
      notes: "",
    });
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
                  const nextSchools = districts.find((d) => d.id === value)?.schools ?? [];
                  form.setValue("schoolId", nextSchools[0]?.id ?? "");
                }}
                disabled={districts.length === 0}
              >
                <FormControl>
                  <SelectTrigger id="requestDistrictId" className="w-full">
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
                onValueChange={field.onChange}
                disabled={schools.length === 0}
              >
                <FormControl>
                  <SelectTrigger id="requestSchoolId" className="w-full">
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
                onValueChange={field.onChange}
                disabled={programs.length === 0}
              >
                <FormControl>
                  <SelectTrigger id="requestProgramId" className="w-full">
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

        {selectedProgram?.code === "FLL" ? (
          <FormField
            control={form.control}
            name="fllDivision"
            render={({ field }) => (
              <FormItem>
                <FormLabel>FLL Division</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger id="fllDivision" className="w-full">
                      <SelectValue placeholder="Division" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="DISCOVER">Discover</SelectItem>
                    <SelectItem value="EXPLORE">Explore</SelectItem>
                    <SelectItem value="CHALLENGE">Challenge</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">Optional for LEGO League team setup</p>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <FormField
          control={form.control}
          name="teamName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team Name</FormLabel>
              <FormControl>
                <Input {...field} id="teamName" placeholder="e.g. Robotics Team Alpha" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="shortCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Short Code</FormLabel>
              <FormControl>
                <Input {...field} id="shortCode" placeholder="e.g. RTA" />
              </FormControl>
              <p className="text-muted-foreground text-xs">Optional team abbreviation</p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="glAccount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GL Account</FormLabel>
              <FormControl>
                <Input {...field} id="glAccount" placeholder="e.g. 61-296-7920-099-978-0000" />
              </FormControl>
              <p className="text-muted-foreground text-xs">Optional GL account number</p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  id="notes"
                  placeholder="Any additional details about the team..."
                  rows={3}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button variant="secondary" type="submit" loading={form.formState.isSubmitting}>
          Submit Request
        </Button>
      </form>
    </Form>
  );
}
