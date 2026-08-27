from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

SUPPORTED_ENTITIES = {
    "PERSON",
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "CREDIT_CARD",
    "US_SSN",
    "DATE_TIME",
    "LOCATION",
    "ORGANIZATION"
}

class RedactionRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=1,
        description="Raw text payload to analyze and redact",
        json_schema_extra={"example": "Please contact Sarah Connor at sarah.c@sky.net or call 555-0123."}
    )
    language: str = Field(
        default="en",
        description="ISO 639-1 language code",
        json_schema_extra={"example": "en"}
    )
    entities: Optional[List[str]] = Field(
        default=None,
        description="List of specific PII entity types to detect. If omitted/null, all supported entities are scanned.",
        json_schema_extra={"example": ["PERSON", "EMAIL_ADDRESS", "PHONE_NUMBER"]}
    )
    @field_validator('entities')
    def validate_entities(cls, v):
        if v is not None:
            invalid_entities = [entity for entity in v if entity not in SUPPORTED_ENTITIES]
            if invalid_entities:
                raise ValueError(f"Invalid entities provided: {', '.join(invalid_entities)}. Supported entities are: {', '.join(SUPPORTED_ENTITIES)}")
        return v
    mask_char: Optional[str] = Field(
        default="*",
        max_length=1,
        description="Character used for masking sensitive text",
        json_schema_extra={"example": "*"}
    )


class EntityDetectionResult(BaseModel):
    entity_type: str = Field(..., description="Category of the detected PII entity", json_schema_extra={"example": "PERSON"})
    start: int = Field(..., description="Starting character index in the original text", json_schema_extra={"example": 15})
    end: int = Field(..., description="Ending character index in the original text", json_schema_extra={"example": 27})
    score: float = Field(..., description="Model confidence score between 0.0 and 1.0", json_schema_extra={"example": 0.85})
    text: Optional[str] = Field(None, description="The extracted raw sensitive snippet", json_schema_extra={"example": "Sarah Connor"})


class RedactionResponse(BaseModel):
    original_text: str
    redacted_text: str
    entities_detected: List[EntityDetectionResult]
    total_entities_found: int
    processing_time_ms: float