import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/sklad/$itemId")({
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/warehouse/$itemId",
      params,
      search,
    });
  },
});
