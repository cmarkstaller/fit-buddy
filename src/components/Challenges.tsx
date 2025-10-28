import { Trophy } from "lucide-react";

export function Challenges() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Challenges</h1>
              <p className="text-sm text-gray-600">Compete and win!</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* Coming Soon Card */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl shadow-lg p-8 text-center">
          <div className="mb-6 flex justify-center">
            <div className="h-20 w-20 bg-black bg-opacity-30 rounded-full flex items-center justify-center">
              <Trophy className="h-10 w-10 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Challenges</h2>
          <p className="text-lg text-white opacity-90 max-w-md mx-auto mb-6">
            Get ready to compete with others in exciting fitness challenges and
            fun games! Test your willpower, compare your progress, and stay
            motivated together.
          </p>
          <div className="bg-black bg-opacity-30 backdrop-blur-sm rounded-lg p-4 text-white max-w-xl mx-auto">
            <p className="text-sm font-medium mb-2">✨ Stay tuned for:</p>
            <ul className="text-sm space-y-1 text-left inline-block">
              <li>• Weekly weight loss competitions</li>
              <li>• Goal achievement challenges</li>
              <li>• Friend vs friend competitions</li>
              <li>• Leaderboards and rewards</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
