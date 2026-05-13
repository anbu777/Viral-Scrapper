import { repo } from "@/db/repositories";
import { CreatorsClient } from "./creators-client";

export default async function CreatorsPage() {
  const creators = await repo.creators.list();
  return <CreatorsClient initialCreators={creators} />;
}
