type RoleFilterOption = {
  value: string;
  label: string;
};

export function getRoleFilterOptions(canEditGlobalRoles: boolean): RoleFilterOption[] {
  return canEditGlobalRoles
    ? [
        { value: "", label: "All Roles" },
        { value: "SUPER_ADMIN", label: "Super Admin" },
        { value: "USER", label: "User" },
      ]
    : [
        { value: "", label: "All Roles" },
        { value: "USER", label: "User" },
      ];
}
