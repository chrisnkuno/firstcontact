from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env.local", "../../.env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["development", "staging", "production", "test"] = "development"
    convex_url: str = ""
    workflow_action_secret: SecretStr = Field(default=SecretStr(""))
    fastapi_service_token: SecretStr = Field(default=SecretStr(""))
    oidc_issuer_url: str = ""
    oidc_audience: str = ""
    execution_mode: Literal["e2b", "disabled"] = "disabled"
    e2b_api_key: SecretStr = Field(default=SecretStr(""))
    e2b_template: str = "base"
    e2b_template_version: str = "firstcontact-python-v1"
    e2b_worker_version: str = "0.1.0"
    e2b_timeout_seconds: int = Field(default=180, ge=30, le=900)
    workflow_lease_seconds: int = Field(default=300, ge=30, le=900)
    dispatcher_poll_seconds: float = Field(default=2.0, ge=0.25, le=60)
    dispatcher_id: str = "firstcontact-fastapi"
    worker_gateway_url: str = ""
    exa_api_key: SecretStr = Field(default=SecretStr(""))
    exa_timeout_seconds: int = Field(default=30, ge=5, le=120)

    @property
    def convex_configured(self) -> bool:
        return bool(self.convex_url and self.workflow_action_secret.get_secret_value())

    @property
    def e2b_configured(self) -> bool:
        return self.execution_mode == "e2b" and bool(self.e2b_api_key.get_secret_value() and self.e2b_template)

    @property
    def oidc_configured(self) -> bool:
        return bool(self.oidc_issuer_url and self.oidc_audience)

    @property
    def research_configured(self) -> bool:
        return bool(self.exa_api_key.get_secret_value() and self.worker_gateway_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()
