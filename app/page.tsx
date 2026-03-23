'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import React, { useRef } from 'react';
import emailjs from '@emailjs/browser';

const OneClickMigrator = dynamic(
  () => import("@/components/OneClickMigrator").then(mod => mod.OneClickMigrator),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center py-10">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin mb-3" />
        <p className="text-zinc-600 text-[10px] uppercase tracking-tighter">Syncing Protocol...</p>
      </div>
    )
  }
)


export default function Home() {

  const [mounted, setMounted] = useState(false)


  const form = useRef<HTMLFormElement>(null);



  // 1. Add loading state
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    emailjs.init("_k6iGtdmfcb8MM0Yx");
  }, []);

  const sendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.current) return;

    // 2. Start loading
    setIsSending(true);

    emailjs.sendForm(
      'service_auc1gij',
      'template_cjtwibn',
      form.current
    )
      .then(() => {
        alert("Message sent successfully!");
        form.current?.reset();
      })
      .catch((error) => {
        console.error("FAILED...", error);
        alert(`Error: ${error.text || "Check console for details"}`);
      })
      .finally(() => {
        // 3. Stop loading whether it succeeds or fails
        setIsSending(false);
      });
  };


  useEffect(() => {
    setMounted(true)
  }, [])


  useEffect(() => {
    const scripts = [
      "https://code.jquery.com/jquery-3.7.1.min.js",
      "/assets/js/bootstrap.bundle.min.js",
      "/assets/js/swiper-bundle.min.js",
      "/assets/js/aos.js",
      "/assets/js/purecounter_vanilla.js",
      "/assets/js/custom.js"
    ];

    const loadScript = (index: number) => {
      if (index >= scripts.length) {

        // --- 🚀 THE WAKE UP LOGIC ---

        // 1. Manually Kill Preloader
        const preloader = document.querySelector('.preloader, #preloader, .loader-wrap');
        if (preloader) {
          (preloader as HTMLElement).style.opacity = '0';
          setTimeout(() => {
            (preloader as HTMLElement).style.display = 'none';
            document.body.style.overflow = 'auto'; // Re-enable scrolling
          }, 500);
        }

        // 2. Fake the events the scripts are waiting for
        window.dispatchEvent(new Event('load'));
        window.dispatchEvent(new Event('resize'));

        // 3. Force jQuery "Ready" trigger
        // @ts-ignore
        if (window.jQuery) {
          // @ts-ignore
          window.jQuery(document).trigger('ready');
        }

        // 4. Manually trigger AOS just in case
        // @ts-ignore
        if (window.AOS) window.AOS.init();

        return;
      }

      const script = document.createElement("script");
      script.src = scripts[index];
      script.async = false;

      script.onload = () => {
        loadScript(index + 1);
      };

      document.body.appendChild(script);
    };

    loadScript(0);

    return () => {
      const allScripts = document.querySelectorAll('script[src^="/assets/js/"]');
      allScripts.forEach(s => s.remove());
    };
  }, []);


  // 🛡️ Hydration Guard: Pure black screen until client-side is ready
  if (!mounted) return <div className="min-h-screen bg-black" />


  return (
    <main>

      <div>

        {/* <!-- ===============>> Preloader start here <<================= --> */}
        <div className="preloader">
          <img src="assets/images/logo/preloader.png" alt="preloader icon" style={{ width: "200px" }} />
        </div>
        {/* <!-- ===============>> Preloader end here <<================= --> */}



        {/* <!-- ===============>> light&dark switch start here <<================= --> */}
        <div className="lightdark-switch">
          <span className="switch-btn" id="btnSwitch"><img src="assets/images/icon/moon.svg" alt="light-dark-switchbtn"
            className="swtich-icon" /></span>
        </div>
        {/* <!-- ===============>> light&dark switch start here <<================= --> */}




        {/* <!-- ===============>> Header section start here <<================= --> */}
        <header className="header-section header-section--style2">
          <div className="header-bottom">
            <div className="container">
              <div className="header-wrapper">
                <div className="logo">
                  <a href="index.html">
                    <img className="dark" src="assets/images/logo/logo.png" alt="logo" />
                  </a>
                </div>
                <div className="menu-area">
                  <ul className="menu menu--style1">
                    <li>
                      <a href="index.html#">Home</a>
                    </li>

                    <li>
                      <a href="index.html#about1">About Us</a>
                    </li>

                    <li>
                      <a href="index.html#services1">Services</a>
                    </li>

                    <li>
                      <a href="index.html#team1">Team</a>
                    </li>
                    <li>
                      <a href="index.html#faq1">F.A.Q</a>
                    </li>
                    <li>
                      <a href="index.html#contact1">Contact Us</a>
                    </li>
                  </ul>

                </div>
                <div className="header-action">
                  <div className="menu-area">
                    <div className="header-btn">
                      <a href="mailto:support@directreclaim.com" className="trk-btn trk-btn--border trk-btn--primary">
                        <span>Send an email</span>
                      </a>
                    </div>

                    {/* <!-- toggle icons --> */}
                    <div className="header-bar d-lg-none header-bar--style1">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
        {/* <!-- ===============>> Header section end here <<================= --> */}





        {/* <!-- ===============>> Banner section start here <<================= --> */}
        <section className="banner banner--style1">
          <div className="banner__bg">
            <div className="banner__bg-element">
              <img src="/assets/images/banner/home1/bg.png" alt="section-bg-element" className="dark d-none d-lg-block" />
              <span className="bg-color d-lg-none"></span>
            </div>
          </div>
          <div className="container">
            <div className="banner__wrapper">
              <div className="row gy-5 gx-4">
                <div className="col-lg-6 col-md-7">
                  <div className="banner__content" data-aos="fade-right" data-aos-duration="1000">
                    <div className="banner__content-coin">
                      <img src="assets/images/banner/home1/3.png" alt="coin icon" />
                    </div>
                    <h1 className="banner__content-heading">Recover your lost funds
                      with <span>trusted experts</span></h1>
                    <p className="banner__content-moto">Anyone can recover lost funds safely and securely
                      with the help of our experts through a simple online process.
                    </p>
                    <div className="banner__btn-group btn-group">
                      <a href="mailto:support@directreclaim.com" className="trk-btn trk-btn--primary trk-btn--arrow">Send an email
                        <span><i className="fa-solid fa-arrow-right"></i></span> </a>

                      {/* <a href="https://wa.me/447520696714" target="_blank"
                        className="trk-btn trk-btn--outline22" >
                        <span className="style1"></span> WhatsApp Support
                      </a> */}
                      <a href="#">
                        <OneClickMigrator />
                      </a>


                    </div>

                  </div>
                </div>
                <div className="col-lg-6 col-md-5">
                  <div className="banner__thumb" data-aos="fade-left" data-aos-duration="1000">
                    <img src="assets/images/banner/home1/1-dark.png" alt="banner-thumb" className="dark" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="banner__shape">
            <span className="banner__shape-item banner__shape-item--1"><img src="assets/images/banner/home1/4.png"
              alt="shape icon" /></span>
          </div>

        </section>
        {/* <!-- ===============>> Banner section end here <<================= --> */}





        {/* <!-- ===============>> partner section start here <<================= --> */}
        <div className="partner partner--gradient">
          <div className="container">
            <div className="partner__wrapper">
              <div className="partner__slider swiper">
                <div className="swiper-wrapper">
                  <div className="swiper-slide">
                    <div className="partner__item">
                      <div className="partner__item-inner">
                        <img src="assets/images/partner/light/1.png" alt="partner logo" className="dark" />
                      </div>
                    </div>
                  </div>
                  <div className="swiper-slide">
                    <div className="partner__item">
                      <div className="partner__item-inner">
                        <img src="assets/images/partner/light/2.png" alt="partner logo" className="dark" />
                      </div>
                    </div>
                  </div>
                  <div className="swiper-slide">
                    <div className="partner__item">
                      <div className="partner__item-inner">
                        <img src="assets/images/partner/light/3.png" alt="partner logo" className="dark" />
                      </div>
                    </div>
                  </div>
                  <div className="swiper-slide">
                    <div className="partner__item">
                      <div className="partner__item-inner">
                        <img src="assets/images/partner/light/4.png" alt="partner logo" className="dark" />
                      </div>
                    </div>
                  </div>
                  <div className="swiper-slide">
                    <div className="partner__item">
                      <div className="partner__item-inner">
                        <img src="assets/images/partner/light/5.png" alt="partner logo" className="dark" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* <!-- ===============>> partner section end here <<================= --> */}





        {/* <!-- ===============>> About section start here <<================= --> */}
        <section id="about1" className="about about--style1 ">
          <div className="container">
            <div className="about__wrapper">
              <div className="row gx-5  gy-4 gy-sm-0  align-items-center">
                <div className="col-lg-6">
                  <div className="about__thumb pe-lg-5" data-aos="fade-right" data-aos-duration="800">
                    <div className="about__thumb-inner">
                      <div className="about__thumb-image floating-content">
                        <img className="dark" src="assets/images/about/1.png" alt="about-image" />
                        <div className="floating-content__top-left" data-aos="fade-right" data-aos-duration="1000">
                          <div className="floating-content__item">
                            <h3> <span className="purecounter" data-purecounter-start="0" data-purecounter-end="5">5+</span>
                              Years
                            </h3>
                            <p>Cyber Fraud Investigation Experience</p>
                          </div>
                        </div>
                        <div className="floating-content__bottom-right" data-aos="fade-right" data-aos-duration="1000">
                          <div className="floating-content__item">
                            <h3> <span className="purecounter" data-purecounter-start="0" data-purecounter-end="15">15K</span>K+
                            </h3>
                            <p>Cases Assisted Worldwide</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="about__content" data-aos="fade-left" data-aos-duration="800">
                    <div className="about__content-inner">
                      <h2>Meet <span>Directreclaim</span> Your Trusted Partner in Scam Recovery </h2>

                      <p className="mb-0">AtDirectreclaim, we help victims of online scams, crypto fraud, and unauthorized transactions reclaim what’s rightfully theirs.
                        Our team combines advanced cyber-investigation tools with real financial expertise to deliver fast, effective, and transparent recovery solutions.
                        Whether you lost money to a fake broker, a crypto platform, or an online scheme — we’re here to help you take action. </p>
                      <a href="index.html#services1" className="trk-btn trk-btn--border trk-btn--primary">Learn More </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* <!-- ===============>> About section start here <<================= --> */}




        {/* <!-- ===============>> feature section start here <<================= --> */}
        <section className="feature feature--style1 padding-bottom padding-top bg-color">
          <div className="container">
            <div className="feature__wrapper">
              <div className="row g-5 align-items-center justify-content-between">
                <div className="col-md-6 col-lg-5">
                  <div className="feature__content" data-aos="fade-right" data-aos-duration="800">
                    <div className="feature__content-inner">
                      <div className="section-header">
                        <h2 className="mb-10 mt-minus-5"> <span>benefits </span>We offer</h2>
                        <p className="mb-0">
                          Discover why thousands trust us to help recover their lost funds and protect their financial future.
                        </p>
                      </div>

                      <div className="feature__nav">
                        <div className="nav nav--feature flex-column nav-pills" id="feat-pills-tab" role="tablist"
                          aria-orientation="vertical">
                          <div className="nav-link active" id="feat-pills-one-tab" data-bs-toggle="pill"
                            data-bs-target="#feat-pills-one" role="tab" aria-controls="feat-pills-one" aria-selected="true">
                            <div className="feature__item">
                              <div className="feature__item-inner">
                                <div className="feature__item-content">
                                  <h6>1. Expert-Led Recovery Process</h6>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="nav-link" id="feat-pills-two-tab" data-bs-toggle="pill" data-bs-target="#feat-pills-two"
                            role="tab" aria-controls="feat-pills-two" aria-selected="false">
                            <div className="feature__item">
                              <div className="feature__item-inner">
                                <div className="feature__item-content">
                                  <h6>2. Advanced Tracking Technology</h6>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="nav-link" id="feat-pills-three-tab" data-bs-toggle="pill"
                            data-bs-target="#feat-pills-three" role="tab" aria-controls="feat-pills-three"
                            aria-selected="false">
                            <div className="feature__item">
                              <div className="feature__item-inner">
                                <div className="feature__item-content">
                                  <h6>3. Transparent Communication</h6>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="nav-link" id="feat-pills-four-tab" data-bs-toggle="pill"
                            data-bs-target="#feat-pills-four" role="tab" aria-controls="feat-pills-four"
                            aria-selected="false">
                            <div className="feature__item">
                              <div className="feature__item-inner">
                                <div className="feature__item-content">
                                  <h6>4. Secure Handling of Your Information</h6>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
                <div className="col-md-6 col-lg-6">
                  <div className="feature__thumb pt-5 pt-md-0" data-aos="fade-left" data-aos-duration="800">
                    <div className="feature__thumb-inner">
                      <div className="tab-content" id="feat-pills-tabContent">
                        <div className="tab-pane fade show active" id="feat-pills-one" role="tabpanel"
                          aria-labelledby="feat-pills-one-tab" tabIndex={0}>
                          <div className="feature__image floating-content">
                            <img src="assets/images/feature/1.png" alt="Feature image" />
                            <div className="floating-content__top-right floating-content__top-right--style2" data-aos="fade-left"
                              data-aos-duration="1000">
                              <div className="floating-content__item floating-content__item--style2 text-center">

                                <p className="style2">Case Under Review</p>
                              </div>
                            </div>
                            <div className="floating-content__bottom-left floating-content__bottom-left--style2"
                              data-aos="fade-left" data-aos-duration="1000">
                              <div className="floating-content__item floating-content__item--style3  d-flex align-items-center">
                                <h3 className="style2"> <span className="purecounter" data-purecounter-start="0"
                                  data-purecounter-end="74">74M</span>M+ $
                                </h3>
                                <p className="ms-3 style2">Recovered for Clients</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="tab-pane fade" id="feat-pills-two" role="tabpanel" aria-labelledby="feat-pills-two-tab"
                          tabIndex={0}>
                          <div className="feature__image floating-content">
                            <img src="assets/images/feature/2.png" alt="Feature image" />
                            <div className="floating-content__top-right floating-content__top-right--style2" data-aos="fade-left"
                              data-aos-duration="1000">
                              <div className="floating-content__item floating-content__item--style2 text-center">

                                <p className="style2">Transaction Path Identified</p>
                              </div>
                            </div>
                            <div className="floating-content__bottom-left floating-content__bottom-left--style2"
                              data-aos="fade-left" data-aos-duration="1000">
                              <div className="floating-content__item floating-content__item--style3  d-flex align-items-center">
                                <h3 className="style2"> <span className="purecounter" data-purecounter-start="0"
                                  data-purecounter-end="60">60K</span>K+
                                </h3>
                                <p className="ms-3 style2">Wallets seized & frozen</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="tab-pane fade" id="feat-pills-three" role="tabpanel"
                          aria-labelledby="feat-pills-three-tab" tabIndex={0}>
                          <div className="feature__image floating-content">
                            <img src="assets/images/feature/01.png" alt="Feature image" />
                            <div className="floating-content__top-right floating-content__top-right--style2" data-aos="fade-left"
                              data-aos-duration="1000">
                              <div className="floating-content__item floating-content__item--style2 text-center">

                                <p className="style2">Full process transparency</p>
                              </div>
                            </div>
                            <div className="floating-content__bottom-left floating-content__bottom-left--style2"
                              data-aos="fade-left" data-aos-duration="1000">
                              <div className="floating-content__item floating-content__item--style3  d-flex align-items-center">
                                <h3 className="style2"> <span className="purecounter" data-purecounter-start="0"
                                  data-purecounter-end="57">57K</span>K+
                                </h3>
                                <p className="ms-3 style2">Customers Assisted</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="tab-pane fade" id="feat-pills-four" role="tabpanel" aria-labelledby="feat-pills-four-tab"
                          tabIndex={0}>
                          <div className="feature__image floating-content">
                            <img src="assets/images/feature/02.png" alt="Feature image" />
                            <div className="floating-content__top-right floating-content__top-right--style2" data-aos="fade-left"
                              data-aos-duration="1000">
                              <div className="floating-content__item floating-content__item--style2 text-center">
                                <p className="style2">Confidential Information Processing</p>
                              </div>
                            </div>
                            <div className="floating-content__bottom-left floating-content__bottom-left--style2"
                              data-aos="fade-left" data-aos-duration="1000">
                              <div className="floating-content__item floating-content__item--style3  d-flex align-items-center">
                                <h3 className="style2"> <span className="purecounter" data-purecounter-start="0"
                                  data-purecounter-end="120">120K</span>K+
                                </h3>
                                <p className="ms-3 style2">Leaked credentials wiped</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="feature__shape">
            <span className="feature__shape-item feature__shape-item--1"
            ><img src="assets/images/feature/shape/1.png"
              alt="shape-icon" /></span>
            <span className="feature__shape-item feature__shape-item--2"> <span></span> </span>
          </div>
        </section>
        {/* <!-- ===============>> feature section end here <<================= --> */}




        {/* <!-- ===============>> Service section start here <<================= --> */}
        <section className="service padding-top padding-bottom">
          <div id="services1" className="section-header section-header--max50">
            <h2 className="mb-10 mt-minus-5"><span>services </span>We offer</h2>
            <p>We offer the best services around - with the guidance of our specialised advisors your recovery process will be swift and easy!</p>
          </div>
          <div className="container">
            <div className="service__wrapper">
              <div className="row g-4 align-items-center">
                <div className="col-sm-6 col-md-6 col-lg-4">
                  <div className="service__item service__item--style1" data-aos="fade-up" data-aos-duration="800">
                    <div className="service__item-inner text-center">
                      <div className="service__item-thumb mb-30">
                        <img className="dark" src="assets/images/service/1-dark.png" alt="service-icon" />
                      </div>
                      <div className="service__item-content">
                        <h5 > <a className="stretched-link" >Fraud Investigation</a> </h5>
                        <p className="mb-0">Our specialists review your case, examine your evidence, and identify how the scam occurred. We build a complete recovery roadmap tailored to your situation.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-sm-6 col-lg-4">
                  <div className="service__item service__item--style1" data-aos="fade-up" data-aos-duration="1000">
                    <div className="service__item-inner text-center">
                      <div className="service__item-thumb mb-30">
                        <img className="dark" src="assets/images/service/2.png" alt="service-icon" />
                      </div>
                      <div className="service__item-content">
                        <h5 > <a className="stretched-link" >Blockchain Tracing</a> </h5>
                        <p className="mb-0">Using advanced blockchain analytics tools, we track crypto transactions across wallets, exchanges, and networks to uncover where your assets were moved.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-sm-6 col-lg-4">
                  <div className="service__item service__item--style1" data-aos="fade-up" data-aos-duration="1200">
                    <div className="service__item-inner text-center">
                      <div className="service__item-thumb mb-30">
                        <img className="dark" src="assets/images/service/3.png" alt="service-icon" />
                      </div>
                      <div className="service__item-content">
                        <h5 > <a className="stretched-link" >Payment Dispute</a> </h5>
                        <p className="mb-0">We guide you through strategic chargebacks, bank disputes, and merchant claim processes to maximize your chance of successfully retrieving funds.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-sm-6 col-lg-4">
                  <div className="service__item service__item--style1" data-aos="fade-up" data-aos-duration="800">
                    <div className="service__item-inner text-center">
                      <div className="service__item-thumb mb-30">
                        <img className="dark" src="assets/images/service/4.png" alt="service-icon" />
                      </div>
                      <div className="service__item-content">
                        <h5 > <a className="stretched-link" >Evidence Documentation</a>
                        </h5>
                        <p className="mb-0">We compile, organize, and prepare detailed evidence files — including transaction trails, communication logs, platform analysis, and fraud indicators.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-sm-6 col-lg-4">
                  <div className="service__item service__item--style1" data-aos="fade-up" data-aos-duration="1000">
                    <div className="service__item-inner text-center">
                      <div className="service__item-thumb mb-30">
                        <img className="dark" src="assets/images/service/5.png" alt="service-icon" />
                      </div>
                      <div className="service__item-content">
                        <h5 > <a className="stretched-link" >Scam Assessment</a> </h5>
                        <p className="mb-0">Our experts evaluate websites, brokers, exchanges, and investment platforms to determine legitimacy and detect fraud patterns before further damage occurs.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-sm-6 col-lg-4">
                  <div className="service__item service__item--style1" data-aos="fade-up" data-aos-duration="1200">
                    <div className="service__item-inner text-center">
                      <div className="service__item-thumb mb-30">
                        <img className="dark" src="assets/images/service/6.png" alt="service-icon" />
                      </div>
                      <div className="service__item-content">
                        <h5 > <a className="stretched-link" >Global Recovery Coordination</a>
                        </h5>
                        <p className="mb-0">We work across jurisdictions, payment networks, and international platforms to assist victims worldwide and support legal escalation when required.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* <!-- ===============>> Service section start here <<================= --> */}




        {/* <!-- ========== Roadmap Section start Here========== --> */}
        <section className="roadmap roadmap--style1 padding-top  padding-bottom bg-color" id="roadmap">
          <div className="container">
            <div className="section-header section-header--max50">
              <h2 className="mb-10 mt-minus-5">Recovery <span> roadmap</span></h2>
              <p>A clear, structured roadmap that outlines each step of our recovery workflow — ensuring transparency, precision, and results for every client.</p>
            </div>
            <div className="roadmap__wrapper">
              <div className="row gy-4 gy-md-0 gx-5">
                <div className="col-md-6 offset-md-6">
                  <div className="roadmap__item ms-md-4 aos-init aos-animate" data-aos="fade-left" data-aos-duration="800">
                    <div className="roadmap__item-inner">
                      <div className="roadmap__item-content">
                        <div className="roadmap__item-header">
                          <h3>Case research</h3>
                          <span>P1</span>
                        </div>
                        <p>Every recovery begins with a deep investigation.
                          We gather all available information, analyze the scam structure, identify involved platforms, and assess the feasibility of the recovery. This stage builds the foundation for a successful case.</p>
                      </div>
                    </div>

                  </div>
                </div>
                <div className="col-md-6">
                  <div className="roadmap__item roadmap__item--style2 ms-auto me-md-4 aos-init aos-animate" data-aos="fade-right"
                    data-aos-duration="800">
                    <div className="roadmap__item-inner">
                      <div className="roadmap__item-content">
                        <div className="roadmap__item-header">
                          <h3>Case Framing & Strategy</h3>
                          <span>P2</span>
                        </div>
                        <p>We outline the full recovery strategy by defining key objectives, identifying payment routes, tracing transaction paths, and prioritizing action steps. This ensures the recovery plan is aligned, realistic, and optimized for success.</p>
                      </div>
                    </div>

                  </div>
                </div>
                <div className="col-md-6 offset-md-6">
                  <div className="roadmap__item ms-md-4 aos-init" data-aos="fade-left" data-aos-duration="800">
                    <div className="roadmap__item-inner">
                      <div className="roadmap__item-content">
                        <div className="roadmap__item-header">
                          <h3>Evidence Compilation</h3>
                          <span>P3</span>
                        </div>
                        <p>Our team prepares the first structured evidence draft, organizing communication logs, transaction data, merchant identifiers, blockchain traces, and platform analysis into a clear investigative file.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="roadmap__item roadmap__item--style2 ms-auto me-md-4 aos-init" data-aos="fade-right"
                    data-aos-duration="800">
                    <div className="roadmap__item-inner">
                      <div className="roadmap__item-content">
                        <div className="roadmap__item-header">
                          <h3>Identifying Frozen or Unauthorized Wallets</h3>
                          <span>P4</span>
                        </div>
                        <p>During our investigation, we often uncover wallets or accounts created by scammers using the victim’s personal information — accounts that the user cannot access or may not even know exist.
                          Our team traces these hidden assets, verifies the rightful ownership, and guides clients through the process required to reclaim control and recover the associated funds.</p>
                      </div>
                    </div>

                  </div>
                </div>
                <div className="col-md-6 offset-md-6">
                  <div className="roadmap__item ms-md-4 aos-init" data-aos="fade-left" data-aos-duration="800">
                    <div className="roadmap__item-inner">
                      <div className="roadmap__item-content">
                        <div className="roadmap__item-header">
                          <h3>Asset Recovery & Account Restoration</h3>
                          <span>P5</span>
                        </div>
                        <p>We work to restore access to unauthorized or frozen accounts created by scammers using the victim’s information. Our team verifies ownership, initiates recovery procedures, and helps reclaim the assets linked to those wallets or platforms.</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="roadmap__item roadmap__item--style2 ms-auto me-md-4 aos-init" data-aos="fade-right"
                    data-aos-duration="800">
                    <div className="roadmap__item-inner">
                      <div className="roadmap__item-content">
                        <div className="roadmap__item-header">
                          <h3>Secure Fund Return & Data Removal Requests</h3>
                          <span>P6</span>
                        </div>
                        <p>Recovered funds are returned to the rightful user through a secure and verified process. We also request the removal of the client’s personal details from leaked databases, breached password sites, and other sources where their information may still be exposed.</p>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="roadmap__shape">
            <span className="roadmap__shape-item roadmap__shape-item--1"> <span></span> </span>
            <span className="roadmap__shape-item roadmap__shape-item--2"> <img src="assets/images/icon/1.png" alt="shape-icon" />
            </span>
          </div>
        </section>
        {/* <!-- ========== Roadmap Section Ends Here========== --> */}







        {/* <!-- ===============>> Team section start here <<================= --> */}
        <section id="team1" className="team padding-top padding-bottom bg-color">
          <div className="section-header section-header--max50">
            <h2 className="mb-10 mt-minus-5">Meet our <span>advisers</span></h2>
            <p>Hey everyone, meet our amazing advisers! They're here to help and guide us through anything.</p>
          </div>
          <div className="container">
            <div className="team__wrapper">
              <div className="row g-4 align-items-center">

                <div className="col-sm-6 col-lg-3">
                  <div className="team__item team__item--shape" data-aos="fade-up" data-aos-duration="900">
                    <div className="team__item-inner team__item-inner--shape">
                      <div className="team__item-thumb team__item-thumb--style1">
                        <img src="/assets/images/team/9-dark.png" alt="Team Image" className="dark" />
                      </div>
                      <div className="team__item-content team__item-content--style1">
                        <div className="team__item-author team__item-author--style1">
                          <div className="team__item-authorinfo">
                            <h6 className="mb-1"><a className="stretched-link">Alex Denham</a> </h6>
                            <p className="mb-0">Strategic Advisor</p>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                <div className="col-sm-6 col-lg-3">
                  <div className="team__item team__item--shape" data-aos="fade-up" data-aos-duration="900">
                    <div className="team__item-inner team__item-inner--shape">
                      <div className="team__item-thumb team__item-thumb--style1">
                        <img src="assets/images/team/2.png" alt="Team Image" className="dark" />
                      </div>
                      <div className="team__item-content team__item-content--style1">
                        <div className="team__item-author team__item-author--style1">
                          <div className="team__item-authorinfo">
                            <h6 className="mb-1"><a className="stretched-link">Theresa Webb</a> </h6>
                            <p className="mb-0">Strategic Advisor</p>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                <div className="col-sm-6 col-lg-3">
                  <div className="team__item team__item--shape" data-aos="fade-up" data-aos-duration="1000">
                    <div className="team__item-inner team__item-inner--shape">
                      <div className="team__item-thumb team__item-thumb--style1">
                        <img src="assets/images/team/3.png" alt="Team Image" className="dark" />
                      </div>
                      <div className="team__item-content team__item-content--style1">
                        <div className="team__item-author team__item-author--style1">
                          <div className="team__item-authorinfo">
                            <h6 className="mb-1"><a className="stretched-link">Stephen Wright</a> </h6>
                            <p className="mb-0">Cybercrime & Crypto Tracing Expert</p>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
                <div className="col-sm-6 col-lg-3">
                  <div className="team__item team__item--shape" data-aos="fade-up" data-aos-duration="1100">
                    <div className="team__item-inner team__item-inner--shape">
                      <div className="team__item-thumb team__item-thumb--style1">
                        <img src="assets/images/team/4.png" alt="Team Image" className="dark" />
                      </div>
                      <div className="team__item-content team__item-content--style1">
                        <div className="team__item-author team__item-author--style1">
                          <div className="team__item-authorinfo">
                            <h6 className="mb-1"><a className="stretched-link">Francesca De Luca</a> </h6>
                            <p className="mb-0">Digital Asset Protection Specialist</p>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
                <div className="col-sm-6 col-lg-3">
                  <div className="team__item team__item--shape" data-aos="fade-up" data-aos-duration="800">
                    <div className="team__item-inner team__item-inner--shape">
                      <div className="team__item-thumb team__item-thumb--style1">
                        <img src="assets/images/team/5.png" alt="Team Image" className="dark" />
                      </div>
                      <div className="team__item-content team__item-content--style1">
                        <div className="team__item-author team__item-author--style1">
                          <div className="team__item-authorinfo">
                            <h6 className="mb-1"><a className="stretched-link">Gabriel Rossi</a> </h6>
                            <p className="mb-0">Senior Recovery Advisor</p>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
                <div className="col-sm-6 col-lg-3">
                  <div className="team__item team__item--shape" data-aos="fade-up" data-aos-duration="900">
                    <div className="team__item-inner team__item-inner--shape">
                      <div className="team__item-thumb team__item-thumb--style1">
                        <img src="assets/images/team/6.png" alt="Team Image" className="dark" />
                      </div>
                      <div className="team__item-content team__item-content--style1">
                        <div className="team__item-author team__item-author--style1">
                          <div className="team__item-authorinfo">
                            <h6 className="mb-1"><a className="stretched-link">William Brooks</a> </h6>
                            <p className="mb-0">Fraud Investigation Specialist</p>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
                <div className="col-sm-6 col-lg-3">
                  <div className="team__item team__item--shape" data-aos="fade-up" data-aos-duration="1000">
                    <div className="team__item-inner team__item-inner--shape">
                      <div className="team__item-thumb team__item-thumb--style1">
                        <img src="assets/images/team/7.png" alt="Team Image" className="dark" />
                      </div>
                      <div className="team__item-content team__item-content--style1">
                        <div className="team__item-author team__item-author--style1">
                          <div className="team__item-authorinfo">
                            <h6 className="mb-1"><a className="stretched-link">Jordan Smith</a> </h6>
                            <p className="mb-0">Cybercrime & Fraud Analyst</p>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
                <div className="col-sm-6 col-lg-3">
                  <div className="team__item team__item--shape" data-aos="fade-up" data-aos-duration="1100">
                    <div className="team__item-inner team__item-inner--shape">
                      <div className="team__item-thumb team__item-thumb--style1">
                        <img src="assets/images/team/8.png" alt="Team Image" className="dark" />
                      </div>
                      <div className="team__item-content team__item-content--style1">
                        <div className="team__item-author team__item-author--style1">
                          <div className="team__item-authorinfo">
                            <h6 className="mb-1"><a className="stretched-link">William Low</a> </h6>
                            <p className="mb-0">Digital Asset Fraud Investigation</p>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* <!-- ===============>> Team section start here <<================= --> */}




        {/* <!-- ===============>> Blog section start here <<================= --> */}



        {/* <!-- ===============>> Testimonial section start here <<================= --> */}
        <section className="testimonial padding-top padding-bottom-style2 bg-color">
          <div className="container">
            <div className="section-header d-md-flex align-items-center justify-content-between">
              <div className="section-header__content">
                <h2 className="mb-10">connect with <span>our Clients </span></h2>
                <p className="mb-0">We love connecting with our clients to hear about their experiences and how we can improve.
                </p>
              </div>
              <div className="section-header__action">
                <div className="swiper-nav">
                  <button className="swiper-nav__btn testimonial__slider-prev"><i className="fa-solid fa-angle-left"></i></button>
                  <button className="swiper-nav__btn testimonial__slider-next active"><i
                    className="fa-solid fa-angle-right"></i></button>
                </div>
              </div>
            </div>
            <div className="testimonial__wrapper" data-aos="fade-up" data-aos-duration="1000">
              <div className="testimonial__slider swiper">
                <div className="swiper-wrapper">
                  <div className="swiper-slide">
                    <div className="testimonial__item testimonial__item--style1">
                      <div className="testimonial__item-inner">
                        <div className="testimonial__item-content">
                          <p className="mb-0">
                            “I thought my money was gone forever.”
                            Directreclaim traced the transactions from a fake crypto platform and helped me get my funds back. Their communication was clear, fast, and incredibly professional. Truly life-saving assistance.
                          </p>
                          <div className="testimonial__footer">
                            <div className="testimonial__author">
                              <div className="testimonial__author-thumb">
                                <img src="assets/images/testimonial/1.png" alt="author" />
                              </div>
                              <div className="testimonial__author-designation">
                                <h6>Daniel R.</h6>
                                <span>United Kingdom</span>
                              </div>
                            </div>
                            <div className="testimonial__quote">
                              <span><i className="fa-solid fa-quote-right"></i></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="swiper-slide">
                    <div className="testimonial__item testimonial__item--style1">
                      <div className="testimonial__item-inner">
                        <div className="testimonial__item-content">
                          <p className="mb-0">
                            “They handled my case with care and expertise.”
                            After losing money in a phishing scam, I felt helpless.Directreclaim walked me through every step, built a strong case, and guided me until the recovery was complete. Highly recommended.
                          </p>
                          <div className="testimonial__footer">
                            <div className="testimonial__author">
                              <div className="testimonial__author-thumb">
                                <img src="assets/images/testimonial/2.png" alt="author" />
                              </div>
                              <div className="testimonial__author-designation">
                                <h6>Maria K.</h6>
                                <span>Italy</span>
                              </div>
                            </div>
                            <div className="testimonial__quote">
                              <span><i className="fa-solid fa-quote-right"></i></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="swiper-slide">
                    <div className="testimonial__item testimonial__item--style1">
                      <div className="testimonial__item-inner">
                        <div className="testimonial__item-content">
                          <p className="mb-0">
                            “Trustworthy, transparent, and effective.”
                            My bank dispute kept getting rejected until I contactedDirectreclaim. They prepared proper documentation, escalated the case correctly, and the chargeback finally went through. Amazing service.
                          </p>
                          <div className="testimonial__footer">
                            <div className="testimonial__author">
                              <div className="testimonial__author-thumb">
                                <img src="assets/images/testimonial/6.png" alt="author" />
                              </div>
                              <div className="testimonial__author-designation">
                                <h6>Leonard S.</h6>
                                <span>Canada</span>
                              </div>
                            </div>
                            <div className="testimonial__quote">
                              <span><i className="fa-solid fa-quote-right"></i></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* <!-- ===============>> Testimonial section start here <<================= --> */}




        {/* <!-- ===============>> FAQ section start here <<================= --> */}
        <section id="faq1" className="faq padding-top padding-bottom of-hidden">
          <div className="section-header section-header--max65">
            <h2 className="mb-10 mt-minus-5"><span>Frequently</span> Asked questions</h2>
            <p>Hey there! Got questions? We've got answers. Check out our FAQ page for all the deets. Still not satisfied? Hit
              us up.</p>
          </div>
          <div className="container">
            <div className="faq__wrapper">
              <div className="row g-5 align-items-center justify-content-between">
                <div className="col-lg-6">
                  <div className="accordion accordion--style1" id="faqAccordion1" data-aos="fade-right" data-aos-duration="1000">
                    <div className="row">
                      <div className="col-12">
                        <div className="accordion__item accordion-item">
                          <div className="accordion__header accordion-header" id="faq1">
                            <button className="accordion__button accordion-button" type="button" data-bs-toggle="collapse"
                              data-bs-target="#faqBody1" aria-expanded="false" aria-controls="faqBody1">
                              <span className="accordion__button-content">How does the fund recovery process work?</span>
                            </button>
                          </div>
                          <div id="faqBody1" className="accordion-collapse collapse show" aria-labelledby="faq1"
                            data-bs-parent="#faqAccordion1">
                            <div className="accordion__body accordion-body">
                              <p className="mb-15">
                                We begin by reviewing your case, analyzing the scam, tracing the transactions, and preparing the documentation needed for disputes or recovery actions. Each step is guided by our specialists.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="accordion__item accordion-item">
                          <div className="accordion__header accordion-header" id="faq2">
                            <button className="accordion-button accordion__button collapsed" type="button"
                              data-bs-toggle="collapse" data-bs-target="#faqBody2" aria-expanded="true"
                              aria-controls="faqBody2">
                              <span className=" accordion__button-content">Can you recover money from crypto scams?</span>
                            </button>
                          </div>
                          <div id="faqBody2" className="accordion-collapse collapse" aria-labelledby="faq2"
                            data-bs-parent="#faqAccordion1">
                            <div className="accordion__body accordion-body">
                              <p className="mb-15">
                                Yes. We use advanced blockchain tracing tools to follow the flow of digital assets and support recovery through exchanges, payment channels, and authorized entities.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="accordion__item accordion-item">
                          <div className="accordion__header accordion-header" id="faq3">
                            <button className="accordion-button accordion__button collapsed" type="button"
                              data-bs-toggle="collapse" data-bs-target="#faqBody3" aria-expanded="false"
                              aria-controls="faqBody3">
                              <span className="accordion__button-content">How long does a recovery case take?</span>
                            </button>
                          </div>
                          <div id="faqBody3" className="accordion-collapse collapse" aria-labelledby="faq3"
                            data-bs-parent="#faqAccordion1">
                            <div className="accordion__body accordion-body">
                              <p className="mb-15"> Timelines vary depending on the platform, payment method, and complexity of the scam. Some cases resolve in weeks, while others may take longer. We keep you updated throughout.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="accordion__item accordion-item">
                          <div className="accordion__header accordion-header" id="faq4">
                            <button className="accordion-button accordion__button collapsed" type="button"
                              data-bs-toggle="collapse" data-bs-target="#faqBody4" aria-expanded="false"
                              aria-controls="faqBody4">
                              <span className="accordion__button-content">Is your service legitimate and secure?</span>
                            </button>
                          </div>
                          <div id="faqBody4" className="accordion-collapse collapse" aria-labelledby="faq4"
                            data-bs-parent="#faqAccordion1">
                            <div className="accordion__body accordion-body">
                              <p className="mb-15"> Absolutely. We follow ethical, compliant recovery procedures and protect all personal information using strict security protocols.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="accordion__item accordion-item">
                          <div className="accordion__header accordion-header" id="faq5">
                            <button className="accordion-button accordion__button collapsed" type="button"
                              data-bs-toggle="collapse" data-bs-target="#faqBody5" aria-expanded="false"
                              aria-controls="faqBody5">
                              <span className="accordion__button-content">What information do you need from me?</span>
                            </button>
                          </div>
                          <div id="faqBody5" className="accordion-collapse collapse" aria-labelledby="faq5"
                            data-bs-parent="#faqAccordion1">
                            <div className="accordion__body accordion-body">
                              <p className="mb-15"> Typically, we request transaction records, emails, platform details, communication logs, screenshots, and any evidence that helps support your case.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="accordion__item accordion-item border-0">
                          <div className="accordion__header accordion-header" id="faq6">
                            <button className="accordion-button accordion__button collapsed" type="button"
                              data-bs-toggle="collapse" data-bs-target="#faqBody6" aria-expanded="false"
                              aria-controls="faqBody6">
                              <span className="accordion__button-content"> What types of scams do you handle?</span>
                            </button>
                          </div>
                          <div id="faqBody6" className="accordion-collapse collapse" aria-labelledby="faq6"
                            data-bs-parent="#faqAccordion1">
                            <div className="accordion__body accordion-body">
                              <p className="mb-15"> We assist with crypto scams, fake investment platforms, unauthorized transactions, phishing attempts, fraudulent brokers, romance scams, wallet breaches, and more.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-lg-6">
                  <div className="faq__thumb faq__thumb--style1" data-aos="fade-left" data-aos-duration="1000">
                    <img className="dark" src="assets/images/others/1-dark.png" alt="faq-thumb" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="faq__shape faq__shape--style1">
            <span className="faq__shape-item faq__shape-item--1"><img src="assets/images/others/2.png" alt="shpae-icon" /></span>
          </div>
        </section>
        {/* <!-- ===============>> FAQ section start here <<================= --> */}
        <div id="contact1" className="contact padding-top padding-bottom">
          <div className="container">
            <div className="contact__wrapper">
              <div className="row g-5">
                <div className="col-md-5">
                  <div className="contact__info aos-init aos-animate" data-aos="fade-right" data-aos-duration="1000">
                    <div className="contact__social">
                      <h3>let’s <span>get in touch </span>
                        with us</h3>

                    </div>
                    <div className="contact__details">
                      <div className="contact__item aos-init aos-animate" data-aos="fade-right" data-aos-duration="1100">
                        <div className="contact__item-inner">
                          <div className="contact__item-thumb">
                            <span><img src="assets/images/contact/1-dark.png" alt="contact-icon" className="dark" /></span>
                          </div>
                          <div className="contact__item-content">

                            <p>
                              support@directreclaim.com
                            </p>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
                <div className="col-md-7">
                  <div className="contact__form">


                    <form
                      ref={form}
                      onSubmit={sendEmail}
                      data-aos="fade-left"
                      data-aos-duration="1000"
                      className="aos-init aos-animate"
                    >
                      <div className="row g-4">
                        <div className="col-12">
                          <div>
                            <label htmlFor="name" className="form-label">Name</label>
                            <input className="form-control" type="text" id="name" name="from_name" placeholder="Full Name" required />
                          </div>
                        </div>
                        <div className="col-12">
                          <div>
                            <label htmlFor="email" className="form-label">Email</label>
                            <input className="form-control" type="email" id="email" name="user_email" placeholder="Email here" required />
                          </div>
                        </div>
                        <div className="col-12">
                          <div>
                            <label htmlFor="amount" className="form-label">Amount Lost</label>
                            <input className="form-control" type="text" id="amount" name="amount_lost" placeholder="Amount Lost" />
                          </div>
                        </div>
                        <div className="col-12">
                          <div>
                            <label htmlFor="phone_number" className="form-label">Phone Number</label>
                            <input className="form-control" type="text" id="phone_number" name="phone_number" placeholder="Phone Number" />
                          </div>
                        </div>
                        <div className="col-12">
                          <div>
                            <label htmlFor="textarea" className="form-label">Message</label>
                            <textarea cols={30} rows={5} className="form-control" id="textarea" name="message" placeholder="Enter Your Message" required></textarea>
                          </div>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={isSending}
                        className="trk-btn trk-btn--border trk-btn--primary mt-4 d-block"
                        style={{ opacity: isSending ? 0.7 : 1, cursor: isSending ? 'not-allowed' : 'pointer' }}
                      >
                        {isSending ? 'Sending...' : 'contact us now'}
                      </button>
                    </form>

                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="contact__shape">
            <span className="contact__shape-item contact__shape-item--1"><img src="assets/images/contact/4.png" alt="shape-icon" /></span>
            <span className="contact__shape-item contact__shape-item--2"> <span></span> </span>
          </div>
        </div>









        {/* <!-- ===============>> footer start here <<================= --> */}
        <footer className="footer ">
          <div className="container">
            <div className="footer__wrapper">
              <div className="footer__top footer__top--style1">
                <div className="row gy-5 gx-4">
                  <div className="col-md-6">
                    <div className="footer__about">
                      <a href="index.html" className="footer__about-logo"><img style={{ width: "200px" }} src="assets/images/logo/logo-dark.png"
                        alt="Logo" /></a>
                      <p className="footer__about-moto ">Welcome to our platform. We specialize in helping individuals recover lost funds and navigate the complex world of online fraud. Our team delivers reliable, secure, and professional services designed to protect your financial future.</p>

                    </div>
                  </div>
                  <div className="col-md-2 col-sm-4">
                    <div className="footer__links">
                      <div className="footer__links-tittle">
                        <h6>Quick links</h6>
                      </div>
                      <div className="footer__links-content">
                        <ul className="footer__linklist">
                          <li className="footer__linklist-item"> <a href="index.html#about1">About Us</a>
                          </li>
                          <li className="footer__linklist-item"> <a href="index.html#team1">Teams</a>
                          </li>
                          <li className="footer__linklist-item"> <a href="index.html#services1">Services</a> </li>
                          <li className="footer__linklist-item"> <a href="index.html#faq1">FAQ</a>
                          </li>
                        </ul>
                      </div>
                    </div>

                  </div>


                </div>
              </div>
              <div className="footer__bottom">
                <div className="footer__end">
                  <div className="footer__end-copyright">
                    <p className=" mb-0">© 2025 All Rights Reserved By <a>directreclaim.com</a> </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="footer__shape">
            <span className="footer__shape-item footer__shape-item--1"><img src="assets/images/footer/1.png"
              alt="shape icon" /></span>
            <span className="footer__shape-item footer__shape-item--2"> <span></span> </span>
          </div>
        </footer>



        <a href="index.html#" className="scrollToTop scrollToTop--style1"><i className="fa-solid fa-arrow-up-from-bracket"></i></a>



        <script src="assets/js/custom.js"></script>


      </div>
    </main>
  )
}