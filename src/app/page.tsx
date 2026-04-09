import RegistrationPortal from "../components/registration/RegistrationPortal";

export default function HomePage() {
  return (
    <RegistrationPortal
      workshopQrSrc="/payments/workshop-qr.png"
      hackathonQrSrc="/payments/hackathon-qr.png"
    />
  );
}
