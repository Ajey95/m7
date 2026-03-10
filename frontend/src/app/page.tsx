import ParallaxBackground from "../components/ParallaxBackground";
import Navbar from "../components/Navbar";
import HeroSection from "../components/HeroSection";
import TrustedByMarquee from "../components/TrustedByMarquee";
import FeaturesSection from "../components/FeaturesSection";
import IntelligentDistribution from "../components/IntelligentDistribution";
import EcosystemSection from "../components/EcosystemSection";
import CTASection from "../components/CTASection";
import Footer from "../components/Footer";
import RevealOnScroll from "../components/RevealOnScroll";

export default function Home() {
  return (
    <>
      <ParallaxBackground />
      <Navbar />
      <HeroSection />
      <TrustedByMarquee />
      <FeaturesSection />
      <IntelligentDistribution />
      <EcosystemSection />
      <CTASection />
      <Footer />
      <RevealOnScroll />
    </>
  );
}
