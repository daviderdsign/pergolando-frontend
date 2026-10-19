import {notFound} from "next/navigation";
import {headers} from "next/headers";
import {Preview} from "./preview";
export default async function Page(){const request=await headers();if(request.get('host')!=='127.0.0.1:3101')notFound();return <Preview/>;}