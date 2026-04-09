"use client";

import { useState } from 'react';

export default function Home() {
    const [teamSize, setTeamSize] = useState(3);
    const [uploadStatus, setUploadStatus] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [secretImageUrl, setSecretImageUrl] = useState("");
    const [formSuccess, setFormSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) {
            setSecretImageUrl("");
            setUploadStatus("");
            return;
        }

        setUploadStatus(">>> TRANSMITTING IMAGE TO SECURE VAULT...");
        setIsUploading(true);

        const formData = new FormData();
        formData.append("image", file);

        try {
            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData
            });
            const data = await response.json();

            if (data.success && data.url) {
                setSecretImageUrl(data.url);
                setUploadStatus(">>> IMAGE UPLOAD COMPLETE. SECURE LINK ESTABLISHED.");
            } else {
                setUploadStatus(`[!] UPLOAD FAILED. TRY AGAIN.`);
            }
        } catch {
            setUploadStatus("[!] SECURE CONNECTION LOST. TRY AGAIN.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        const formElement = event.target;

        // Collect team info from semantic field IDs (no Google Form entry-id dependency)
        const teamName = formElement.querySelector("#team-name")?.value?.trim() || "";
        const collegeName = formElement.querySelector("#college-name")?.value?.trim() || "";
        const transactionId = formElement.querySelector("#tx-input")?.value?.trim() || "";

        // Build participants array from the ACTIVE team-size container only
        const containerId = teamSize === 3 ? "team-size-3-fields" : "team-size-4-fields";
        const container = document.getElementById(containerId);
        const participantBlocks = container.querySelectorAll("[style*='border-left']");

        const participants = [];
        participantBlocks.forEach((block) => {
            const inputs = block.querySelectorAll("input");
            if (inputs.length >= 4) {
                participants.push({
                    name: inputs[0].value.trim(),
                    roll: inputs[1].value.trim(),
                    email: inputs[2].value.trim(),
                    phone: inputs[3].value.trim(),
                });
            }
        });

        // Build the structured payload
        const payload = {
            teamName,
            collegeName,
            teamSize,
            participants,
            payment: {
                transactionId,
                screenshotUrl: secretImageUrl || "",
            },
        };

        try {
            const response = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (data.success) {
                setFormSuccess(true);
                formElement.reset();
                setSecretImageUrl("");
                setUploadStatus("");
                setTeamSize(3); // Reset
            } else {
                alert("Submission rejected. Error: " + data.error);
            }
        } catch (err) {
            console.error("Transmission err", err);
            alert("Transmission failed.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <nav className="navbar">
                <div className="logo">AI<span>4</span>Impact <span className="decal-barcode">|| | || |</span></div>
                <div className="nav-links">
                    <a href="/auth">[ AUTH ]</a>
                    <a href="#about">[ ABOUT ]</a>
                    <a href="#objectives">[ OBJECTIVES ]</a>
                    <a href="#timeline">[ TIMELINE ]</a>
                    <a href="#highlights">[ HIGHLIGHTS ]</a>
                    <a href="#sponsors">[ SPONSORS ]</a>
                    <a href="#contact">[ CONTACT ]</a>
                </div>
            </nav>

            <header className="hero">
                <div className="hero-content">
                    <p className="subtitle text-cyan">&gt;&gt;&gt; SYSTEM LOGIN: CBIT_A4I</p>
                    <h1>AI <span className="text-pink">4</span> IMPACT</h1>
                    <p className="tagline">/// LEARN. BUILD. IMPACT.</p>
                    <p className="dates">DATE: 15.04.26 - 18.04.26 <span className="text-red">!WARNING!</span></p>
                    <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                        <a href="#register" className="btn">INITIATE_REGISTRATION()</a>
                        <a href="/auth" className="btn" style={{ boxShadow: '5px 5px 0 var(--neon-pink)' }}>
                            OPEN_AUTH_PORTAL()
                        </a>
                    </div>
                </div>
                <div className="hero-graphic">
                    <div className="huge-logo">
                        <span className="a">A</span><span className="i">I</span>
                    </div>
                </div>
            </header>

            <section id="about" className="section">
                <div className="section-header border-cyan">
                    <h2>/// THE PROBLEM & APPROACH</h2>
                </div>
                <div className="grid-2">
                    <div className="card cyber-card">
                        <h3>01 // THE GAP</h3>
                        <div className="decal-bar"></div>
                        <p>There is a major misunderstanding in society about engineering as a course to get a high-paying job.
                            But rather than what actual engineering feels like, what they are capable of, in deploying practical
                            solutions for societal problems.</p>
                    </div>
                    <div className="card cyber-card">
                        <h3>02 // OUR APPROACH</h3>
                        <div className="decal-bar"></div>
                        <p>Instead of a standard, isolated coding competition, we are integrating <span
                            className="highlight-text">hands-on education</span> on rapid application development. We provide
                            ready-to-use codebase templates to lower the entry barrier, enabling students to immediately focus
                            on <strong>solving real-world issues</strong>.</p>
                    </div>
                </div>
            </section>

            <section id="objectives" className="section">
                <div className="section-header">
                    <h2 className="text-pink">/// OBJECTIVES</h2>
                </div>
                <div className="grid-3">
                    <div className="card cyber-card">
                        <h3 className="text-cyan">[O.P.] 2-DAY WORKSHOPS</h3>
                        <p>We believe steep learning curves shouldn't kill great ideas. Through an <strong>intensive hands-on
                            workshop</strong>, we focus on rapid application development.</p>
                    </div>
                    <div className="card cyber-card">
                        <h3 className="text-cyan">[O.P.] 30HRS HACKATHON</h3>
                        <p>In an intensive brainstorming and developing solutions in a competitive environment... we provide
                            <strong>ready-to-use</strong> templates.</p>
                    </div>
                    <div className="card cyber-card">
                        <h3 className="text-cyan">[O.P.] SOLUTIONS IMPACT</h3>
                        <p>Every line of code written is aimed at prototyping open-source AI and Machine Learning applications
                            that directly address societal issues.</p>
                    </div>
                </div>
            </section>

            <section id="timeline" className="section">
                <div className="section-header">
                    <h2>&gt;&gt;&gt; TIMELINE_DATA</h2>
                </div>
                <div className="timeline-container">
                    <div className="timeline-item">
                        <div className="timeline-dot"></div>
                        <div className="timeline-content">
                            <span className="phase">SYS.DAY 01</span>
                            <h4>15.04.26 // WORKSHOP</h4>
                            <p>Basics of different development frameworks & applications.</p>
                        </div>
                    </div>

                    <div className="timeline-item">
                        <div className="timeline-dot" style={{ background: 'var(--neon-pink)' }}></div>
                        <div className="timeline-content" style={{ boxShadow: '4px 4px 0 var(--neon-cyan)' }}>
                            <span className="phase" style={{ background: 'var(--neon-cyan)', color: 'var(--bg-dark)' }}>SYS.DAY 02</span>
                            <h4 className="text-pink">16.04.26 // WORKSHOP</h4>
                            <p>Implementation of basic AI&ML models & more.</p>
                        </div>
                    </div>

                    <div className="timeline-item">
                        <div className="timeline-dot"></div>
                        <div className="timeline-content">
                            <span className="phase">SYS.DAY 03</span>
                            <h4>17.04.26 // HACKATHON</h4>
                            <p>Inaugural of Hackathon and selection of problem statements.</p>
                        </div>
                    </div>

                    <div className="timeline-item">
                        <div className="timeline-dot" style={{ background: 'var(--danger-red)' }}></div>
                        <div className="timeline-content"
                            style={{ boxShadow: '4px 4px 0 var(--danger-red)', borderColor: 'var(--danger-red)' }}>
                            <span className="phase" style={{ background: 'var(--danger-red)' }}>SYS.DAY 04</span>
                            <h4 className="text-red">18.04.26 // CEREMONY</h4>
                            <p>Team evaluation, Cash prize distribution, Closing Ceremony.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section id="highlights" className="section">
                <div className="section-header">
                    <h2>!WARNING! SYSTEM FEATS</h2>
                </div>
                <div className="highlight-banner" style={{ background: 'var(--neon-pink)', color: '#000' }}>
                    <h3 style={{ color: '#000', textShadow: 'none' }}>[ 60K PRIZE POOL ]</h3>
                    <p style={{ color: '#000' }}>EMPOWERING THE TOP INNOVATORS</p>
                </div>
                <div className="grid-3 stats-grid mt-4">
                    <div className="stat-card cyber-card">
                        <h4>[ 4.2K+ ]</h4>
                        <p>INSTAGRAM FOLLOWERS</p>
                    </div>
                    <div className="stat-card cyber-card" style={{ boxShadow: '6px 6px 0 var(--neon-cyan)' }}>
                        <h4 className="text-pink">[ 1.2K+ ]</h4>
                        <p>GAINED IN 6 MONTHS</p>
                    </div>
                    <div className="stat-card cyber-card">
                        <h4>[ 30K+ ]</h4>
                        <p>CONSISTENT REACH</p>
                    </div>
                    <div className="stat-card cyber-card" style={{ boxShadow: '6px 6px 0 var(--danger-red)' }}>
                        <h4 className="text-red">[ 2 LAKHS+ ]</h4>
                        <p>FUNDS RAISED</p>
                    </div>
                    <div className="stat-card cyber-card">
                        <h4>[ 250K+ ]</h4>
                        <p>AVG. MONTHLY VIEWS</p>
                    </div>
                    <div className="stat-card cyber-card">
                        <h4>[ 1500+ ]</h4>
                        <p>STUDENTS ENGAGED</p>
                    </div>
                </div>
            </section>

            <section id="sponsors" className="section">
                <div className="section-header">
                    <h2>/// SPONSORS_NETWORK</h2>
                </div>
                <div className="cyber-card"
                    style={{ textAlign: 'center', padding: '4rem', borderStyle: 'dashed', borderColor: 'var(--neon-cyan)' }}>
                    <div className="decal-barcode" style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--neon-cyan)' }}>|||| | ||| || |</div>
                    <h3 className="text-pink" style={{ border: 'none' }}>[ AWAITING CONNECTION ]</h3>
                    <p>SPONSORS TO BE ANNOUNCED / SYSTEM STANDBY /</p>
                </div>
            </section>

            <section id="register" className="section">
                <div className="section-header">
                    <h2>/// SYSTEM_REGISTRATION</h2>
                </div>
                <div className="cyber-card" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'left' }}>
                    <p style={{ marginBottom: '2rem', color: 'var(--neon-cyan)' }}>&gt;&gt;&gt; ENTER CREDENTIALS TO SECURE DATABASE UPLINK</p>

                    <form
                        id="registration-form"
                        onSubmit={handleSubmit}
                        style={{ display: formSuccess ? 'none' : 'block' }}
                    >

                        <div className="grid-2" style={{ marginBottom: '2rem', gap: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 'bold' }}>[ TEAM NAME ]</label>
                                <input type="text" id="team-name" name="teamName" required
                                    style={{ width: '100%', padding: '0.8rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'var(--text-main)', fontFamily: 'var(--font-body)', textTransform: 'uppercase' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 'bold' }}>[ COLLEGE NAME ]</label>
                                <input type="text" id="college-name" name="collegeName" required
                                    style={{ width: '100%', padding: '0.8rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'var(--text-main)', fontFamily: 'var(--font-body)', textTransform: 'uppercase' }} />
                            </div>
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label style={{ display: 'block', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 'bold' }}>[ TEAM SIZE ]</label>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <label style={{ color: 'var(--text-main)', cursor: 'pointer' }}>
                                    <input type="radio"
                                        name="teamSize" value="3" checked={teamSize === 3} onChange={() => setTeamSize(3)}
                                        style={{ marginRight: '0.5rem' }} /> SIZE: 3</label>
                                <label style={{ color: 'var(--text-main)', cursor: 'pointer' }}>
                                    <input type="radio"
                                        name="teamSize" value="4" checked={teamSize === 4} onChange={() => setTeamSize(4)}
                                        style={{ marginRight: '0.5rem' }} /> SIZE: 4</label>
                            </div>
                        </div>

                        <hr style={{ border: '1px dashed var(--neon-pink)', marginBottom: '2rem' }} />

                        <div id="team-size-3-fields" style={{ display: teamSize === 3 ? 'block' : 'none' }}>
                            <h3 className="text-pink" style={{ marginBottom: '1.5rem' }}>[ PARTICIPANT DATA: SIZE 3 ]</h3>

                            <div style={{ marginBottom: '1rem', paddingLeft: '1rem', borderLeft: '3px solid var(--neon-cyan)' }}>
                                <p style={{ color: 'var(--neon-cyan)', marginBottom: '1rem', fontWeight: 'bold' }}>PARTICIPANT 1 (LEADER)</p>
                                <div className="grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                                    <input type="text" name="p1Name" placeholder="NAME" required={teamSize === 3}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="text" name="p1Roll" placeholder="ROLL NO." required={teamSize === 3}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="email" name="p1Email" placeholder="EMAIL" required={teamSize === 3}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="tel" name="p1Phone" placeholder="PHONE" required={teamSize === 3}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem', paddingLeft: '1rem', borderLeft: '3px solid var(--text-muted)' }}>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: 'bold' }}>PARTICIPANT 2</p>
                                <div className="grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                                    <input type="text" name="p2Name" placeholder="NAME" required={teamSize === 3}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="text" name="p2Roll" placeholder="ROLL NO." required={teamSize === 3}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="email" name="p2Email" placeholder="EMAIL" required={teamSize === 3}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="tel" name="p2Phone" placeholder="PHONE" required={teamSize === 3}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                </div>
                            </div>

                            <div style={{ marginBottom: '2rem', paddingLeft: '1rem', borderLeft: '3px solid var(--text-muted)' }}>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: 'bold' }}>PARTICIPANT 3</p>
                                <div className="grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                                    <input type="text" name="p3Name" placeholder="NAME" required={teamSize === 3}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="text" name="p3Roll" placeholder="ROLL NO." required={teamSize === 3}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="email" name="p3Email" placeholder="EMAIL" required={teamSize === 3}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="tel" name="p3Phone" placeholder="PHONE" required={teamSize === 3}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                </div>
                            </div>
                        </div>

                        <div id="team-size-4-fields" style={{ display: teamSize === 4 ? 'block' : 'none' }}>
                            <h3 className="text-pink" style={{ marginBottom: '1.5rem' }}>[ PARTICIPANT DATA: SIZE 4 ]</h3>

                            <div style={{ marginBottom: '1rem', paddingLeft: '1rem', borderLeft: '3px solid var(--neon-cyan)' }}>
                                <p style={{ color: 'var(--neon-cyan)', marginBottom: '1rem', fontWeight: 'bold' }}>PARTICIPANT 1 (LEADER)</p>
                                <div className="grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                                    <input type="text" name="p1Name4" placeholder="NAME" required={teamSize === 4}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="text" name="p1Roll4" placeholder="ROLL NO." required={teamSize === 4}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="email" name="p1Email4" placeholder="EMAIL" required={teamSize === 4}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="tel" name="p1Phone4" placeholder="PHONE" required={teamSize === 4}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem', paddingLeft: '1rem', borderLeft: '3px solid var(--text-muted)' }}>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: 'bold' }}>PARTICIPANT 2</p>
                                <div className="grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                                    <input type="text" name="p2Name4" placeholder="NAME" required={teamSize === 4}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="text" name="p2Roll4" placeholder="ROLL NO." required={teamSize === 4}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="email" name="p2Email4" placeholder="EMAIL" required={teamSize === 4}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="tel" name="p2Phone4" placeholder="PHONE" required={teamSize === 4}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem', paddingLeft: '1rem', borderLeft: '3px solid var(--text-muted)' }}>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: 'bold' }}>PARTICIPANT 3</p>
                                <div className="grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                                    <input type="text" name="p3Name4" placeholder="NAME" required={teamSize === 4}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="text" name="p3Roll4" placeholder="ROLL NO." required={teamSize === 4}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="email" name="p3Email4" placeholder="EMAIL" required={teamSize === 4}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="tel" name="p3Phone4" placeholder="PHONE" required={teamSize === 4}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                </div>
                            </div>

                            <div style={{ marginBottom: '2rem', paddingLeft: '1rem', borderLeft: '3px solid var(--text-muted)' }}>
                                <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontWeight: 'bold' }}>PARTICIPANT 4</p>
                                <div className="grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                                    <input type="text" name="p4Name4" placeholder="NAME" required={teamSize === 4}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="text" name="p4Roll4" placeholder="ROLL NO." required={teamSize === 4}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="email" name="p4Email4" placeholder="EMAIL" required={teamSize === 4}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                    <input type="tel" name="p4Phone4" placeholder="PHONE" required={teamSize === 4}
                                        style={{ padding: '0.8rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-main)' }} />
                                </div>
                            </div>
                        </div>

                        <hr style={{ border: '1px dashed var(--neon-cyan)', marginBottom: '2rem' }} />

                        <div>
                            <h3 className="text-cyan" style={{ marginBottom: '1.5rem' }}>[ PAYMENT AUTHENTICATION ]</h3>

                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'block', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 'bold' }}>[ UPLOAD SCREENSHOT ]</label>
                                <input type="file" accept="image/*" id="file-uploader" required onChange={handleFileUpload}
                                    style={{ width: '100%', padding: '0.8rem', background: 'var(--bg-dark)', border: '2px solid var(--neon-cyan)', color: 'var(--text-main)', cursor: 'pointer' }} />
                                <p id="upload-status"
                                    style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: uploadStatus.includes('FAILED') || uploadStatus.includes('LOST') ? 'var(--danger-red)' : (uploadStatus.includes('COMPLETE') ? 'var(--neon-pink)' : 'var(--neon-cyan)'), fontWeight: 'bold' }}>
                                    {uploadStatus}
                                </p>
                            </div>

                            <div>
                                <label style={{ display: 'block', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 'bold' }}>[ TRANSACTION ID ]</label>
                                <input type="text" id="tx-input" name="transactionId" required
                                    style={{ width: '100%', padding: '0.8rem', background: 'var(--bg-dark)', border: '2px solid var(--neon-cyan)', color: 'var(--neon-cyan)', fontFamily: 'var(--font-body)', textTransform: 'uppercase' }} />
                            </div>
                        </div>

                        <button type="submit" id="submit-btn" className="btn" disabled={isUploading || isSubmitting}
                            style={{ width: '100%', textAlign: 'center', marginTop: '2rem', opacity: (isUploading || isSubmitting) ? 0.5 : 1 }}>
                            {isSubmitting ? 'TRANSMITTING...' : 'TRANSMIT COMPLETION()'}
                        </button>
                    </form>

                    {formSuccess && (
                        <div id="form-success"
                            style={{ marginTop: '2rem', padding: '1rem', border: '2px dashed var(--neon-pink)', color: 'var(--neon-pink)', background: 'rgba(255,0,255,0.1)', fontWeight: 'bold', textAlign: 'center' }}>
                            &gt;&gt;&gt; TRANSMISSION RECEIVED. SECURE REGISTRATION COMPLETED AND SYNCED TO DATABASE.
                        </div>
                    )}
                </div>
            </section>

            <section id="contact" className="section">
                <div className="section-header">
                    <h2>/// ESTABLISH UPLINK</h2>
                </div>
                <div className="contact-box">
                    <div className="contact-item">
                        <p><strong>AKHILESH:</strong> 63034 87822 | <strong>NIKHIL:</strong> 93814 37649 |
                            <strong>PRAGNA:</strong> 84988 98884
                        </p>
                    </div>
                    <div className="contact-item">
                        <p><span className="text-cyan">MAIL:</span> CBITNSS@CBIT.AC.IN</p>
                    </div>
                    <div className="contact-item">
                        <p><span className="text-pink">INSTA:</span> @CBITNSS</p>
                    </div>
                </div>
            </section>

            <footer>
                <p>TERMINAL_ACCESS / CBIT NSS / AIDS & AIML</p>
                <p>&copy; 2026 AI 4 IMPACT</p>
            </footer>
        </>
    );
}
