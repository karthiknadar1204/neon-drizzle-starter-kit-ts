import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, BookOpen, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Study Smarter with PDF Tools
        </h1>
        <p className="mt-6 text-xl text-muted-foreground max-w-3xl">
          Transform your study experience with our AI-powered PDF tools. Chat with your documents, create flashcards, and generate summaries.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Button asChild size="lg">
            <Link href="/chat-with-pdf">Get Started</Link>
          </Button>
          <Button variant="outline" size="lg">
            Learn More
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Our Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Chat with PDF Card */}
            <Card className="flex flex-col h-full">
              <CardHeader>
                <div className="mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Chat with PDF</CardTitle>
                <CardDescription>
                  Ask questions and get instant answers from your PDF documents
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p>Upload your study materials and have a conversation with your documents. Our AI will find relevant information and answer your questions.</p>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href="/chat-with-pdf">Try Now</Link>
                </Button>
              </CardFooter>
            </Card>

            {/* Flashcards Card */}
            <Card className="flex flex-col h-full">
              <CardHeader>
                <div className="mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Flashcards</CardTitle>
                <CardDescription>
                  Generate study flashcards from your documents
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p>Automatically create flashcards from your study materials. Review key concepts and test your knowledge with our interactive flashcard system.</p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  Coming Soon
                </Button>
              </CardFooter>
            </Card>

            {/* Summaries Card */}
            <Card className="flex flex-col h-full">
              <CardHeader>
                <div className="mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Summaries</CardTitle>
                <CardDescription>
                  Get concise summaries of your documents
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p>Extract the most important information from your documents. Our AI generates concise summaries to help you grasp key concepts quickly.</p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  Coming Soon
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
