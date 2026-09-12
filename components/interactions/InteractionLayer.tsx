"use client";

import AmbientSlideFx from "@/components/interactions/AmbientSlideFx";
import SlideFiveIdeas from "@/components/interactions/SlideFiveIdeas";
import SlideNineArchitecture from "@/components/interactions/SlideNineArchitecture";
import SlideSevenDragDrop from "@/components/interactions/SlideSevenDragDrop";
import SlideTwoOutcomeUnderlines from "@/components/interactions/SlideTwoOutcomeUnderlines";
import SlideThreeNotCoding from "@/components/interactions/SlideThreeNotCoding";
import SlideFourQuestionMarks from "@/components/interactions/SlideFourQuestionMarks";
import SlideEightHumanRole from "@/components/interactions/SlideEightHumanRole";
import SlideFourteenRestaurantReveal from "@/components/interactions/SlideFourteenRestaurantReveal";
import SlideFifteenEnterpriseReveal from "@/components/interactions/SlideFifteenEnterpriseReveal";
import SlideSixteenLabHero from "@/components/interactions/SlideSixteenLabHero";
import SlideThirteenBasicFlow from "@/components/interactions/SlideThirteenBasicFlow";
import SlideFourteenGeminiGuide from "@/components/interactions/SlideFourteenGeminiGuide";
import SlideFifteenDriveFolder from "@/components/interactions/SlideFifteenDriveFolder";
import SlideSixteenSheetsArrow from "@/components/interactions/SlideSixteenSheetsArrow";
import SlideSeventeenGeminiDoes from "@/components/interactions/SlideSeventeenGeminiDoes";
import SlideEighteenGarbageIn from "@/components/interactions/SlideEighteenGarbageIn";
import SlideNineteenBusinessFirst from "@/components/interactions/SlideNineteenBusinessFirst";
import SlideTwentyRequirementExample from "@/components/interactions/SlideTwentyRequirementExample";
import SlideTwentyOneQuestionDots from "@/components/interactions/SlideTwentyOneQuestionDots";
import SlideTwentyTwoPromptFlow from "@/components/interactions/SlideTwentyTwoPromptFlow";
import SlideTwentyThreePromptChecklist from "@/components/interactions/SlideTwentyThreePromptChecklist";
import SlideTwentyFourPromptCopy from "@/components/interactions/SlideTwentyFourPromptCopy";
import SlideTwentyFiveAppsScriptFlow from "@/components/interactions/SlideTwentyFiveAppsScriptFlow";
import SlideTwentySixCreateFilesFlow from "@/components/interactions/SlideTwentySixCreateFilesFlow";
import SlideTwentyEightDeploymentFlow from "@/components/interactions/SlideTwentyEightDeploymentFlow";
import SlideTwentyNineFirstRunFlow from "@/components/interactions/SlideTwentyNineFirstRunFlow";
import SlideThirtyFourPromptActions from "@/components/interactions/SlideThirtyFourPromptActions";
import SlideThirtyFiveCycleFlow from "@/components/interactions/SlideThirtyFiveCycleFlow";
import SlideClosingAmbient from "@/components/interactions/SlideClosingAmbient";

type Props = {
  pageNumber: number;
};

export default function InteractionLayer({ pageNumber }: Props) {
  if (pageNumber === 1) return null;

  if (pageNumber === 2) return <SlideTwoOutcomeUnderlines />;
  if (pageNumber === 3) return <SlideThreeNotCoding />;
  if (pageNumber === 4) return <SlideFourQuestionMarks />;
  if (pageNumber === 5) return <SlideFiveIdeas />;
  if (pageNumber === 7) return <SlideSevenDragDrop />;
  if (pageNumber === 8) return <SlideEightHumanRole />;
  if (pageNumber === 9) return <SlideNineArchitecture />;

  if (pageNumber === 10) return <SlideFourteenRestaurantReveal />;
  if (pageNumber === 11) return <SlideFifteenEnterpriseReveal />;
  if (pageNumber === 12) return <SlideSixteenLabHero />;

  if (pageNumber === 13) return <SlideThirteenBasicFlow />;
  if (pageNumber === 14) return <SlideFourteenGeminiGuide />;
  if (pageNumber === 15) return <SlideFifteenDriveFolder />;
  if (pageNumber === 16) return <SlideSixteenSheetsArrow />;
  if (pageNumber === 17) return <SlideSeventeenGeminiDoes />;
  if (pageNumber === 18) return <SlideEighteenGarbageIn />;
  if (pageNumber === 19) return <SlideNineteenBusinessFirst />;
  if (pageNumber === 20) return <SlideTwentyRequirementExample />;
  if (pageNumber === 21) return <SlideTwentyOneQuestionDots />;
  if (pageNumber === 22) return <SlideTwentyTwoPromptFlow />;
  if (pageNumber === 23) return <SlideTwentyThreePromptChecklist />;
  if (pageNumber === 24) return <SlideTwentyFourPromptCopy />;
  if (pageNumber === 25) return <SlideTwentyFiveAppsScriptFlow />;
  if (pageNumber === 26) return <SlideTwentySixCreateFilesFlow />;
  if (pageNumber === 28) return <SlideTwentyEightDeploymentFlow />;
  if (pageNumber === 29) return <SlideTwentyNineFirstRunFlow />;
  if (pageNumber === 32) return <SlideClosingAmbient pageNumber={32} />;
  if (pageNumber === 34) return <SlideThirtyFourPromptActions />;
  if (pageNumber === 35) return <SlideThirtyFiveCycleFlow />;
  if (pageNumber === 36) return <SlideClosingAmbient pageNumber={36} />;
  if (pageNumber === 37) return <SlideClosingAmbient pageNumber={37} />;
  if (pageNumber === 38) return <SlideClosingAmbient pageNumber={38} />;

  return <AmbientSlideFx pageNumber={pageNumber} />;
}
