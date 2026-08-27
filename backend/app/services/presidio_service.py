import time
from typing import List, Dict, Any, Optional
from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern, EntityRecognizer, RecognizerResult
from presidio_analyzer.nlp_engine import NlpArtifacts, NlpEngineProvider 
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

class OrganizationRecognizer(EntityRecognizer):
    def __init__(self):
        super().__init__(supported_entities=["ORGANIZATION"])

    def load(self) -> None:
        pass

    def analyze(
        self, text: str, entities: List[str], nlp_artifacts: NlpArtifacts
    ) -> List[RecognizerResult]:
        results = []
        
        if nlp_artifacts and nlp_artifacts.entities:
            for entity in nlp_artifacts.entities:
                # FIX: We must use spaCy's native attributes (.label_, .start_char, .end_char)
                if entity.label_ == "ORG":
                    results.append(
                        RecognizerResult(
                            entity_type="ORGANIZATION",
                            start=entity.start_char,
                            end=entity.end_char,
                            score=0.85 
                        )
                    )
        return results

class PIIRedactionService:
    def __init__(self):
        print("Loading Presidio NLP Engine...")
        
        # 2. Configure the lightweight spaCy model
        configuration = {
            "nlp_engine_name": "spacy",
            "models": [{"lang_code": "en", "model_name": "en_core_web_sm"}],
        }
        provider = NlpEngineProvider(nlp_configuration=configuration)
        nlp_engine = provider.create_engine()
        
        # 3. Inject the lightweight engine into the Analyzer
        self.analyzer = AnalyzerEngine(
            nlp_engine=nlp_engine, 
            supported_languages=["en"]
        )
        
        self.anonymizer = AnonymizerEngine()
        
        # --- UPGRADED CUSTOM RECOGNIZER ---
        # This regex catches:
        # 1. Standard US: 555-0123 or (555) 555-0123
        # 2. International: +91 9876543987 or +44 20 7123 1234
        # 3. Flat 10-digit numbers: 9876543987
        phone_regex = r"(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d{1,3}\s?\d{10}|\b\d{10}\b"
        
        international_phone_pattern = Pattern(
            name="robust_phone_regex",
            regex=phone_regex,
            score=0.85 
        )
        
        phone_recognizer = PatternRecognizer(
            supported_entity="PHONE_NUMBER", 
            patterns=[international_phone_pattern]
        )
        
        self.analyzer.registry.add_recognizer(phone_recognizer)
        # --- NLP ORGANIZATION RECOGNIZER ---
        org_recognizer = OrganizationRecognizer()
        self.analyzer.registry.add_recognizer(org_recognizer)
        # -----------------------------------
        
        print("Presidio Engine Loaded Successfully.")

    def process_text(
        self, 
        text: str, 
        language: str = "en", 
        entities: Optional[List[str]] = None, 
        mask_char: str = "*"
    ) -> Dict[str, Any]:
        
        start_time = time.time()
        
        analyzer_results = self.analyzer.analyze(
            text=text,
            entities=entities,
            language=language
        )
        
        operators = {
            "DEFAULT": OperatorConfig(
                "mask",
                {
                    "masking_char": mask_char,
                    "chars_to_mask": 1000, 
                    "from_end": False
                }
            )
        }
        
        anonymized_result = self.anonymizer.anonymize(
            text=text,
            analyzer_results=analyzer_results,
            operators=operators
        )
        
        entities_detected = []
        for res in analyzer_results:
            entities_detected.append({
                "entity_type": res.entity_type,
                "start": res.start,
                "end": res.end,
                "score": round(res.score, 2),
                "text": text[res.start:res.end]
            })
            
        processing_time_ms = round((time.time() - start_time) * 1000, 2)
        
        return {
            "original_text": text,
            "redacted_text": anonymized_result.text,
            "entities_detected": entities_detected,
            "total_entities_found": len(entities_detected),
            "processing_time_ms": processing_time_ms
        }

redaction_service = PIIRedactionService()