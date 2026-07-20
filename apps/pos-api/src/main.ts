import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ["error", "warn", "log"] });
  const port = Number(process.env.PORT ?? 3099);
  await app.listen(port, "0.0.0.0");
  // eslint-disable-next-line no-console
  console.log(`pos-api listening on http://0.0.0.0:${port}`);
}

void bootstrap();
